import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GINEConv, global_max_pool, global_mean_pool


def build_mlp(
    in_dim: int,
    hidden_dim: int,
    out_dim: int,
    num_layers: int = 2,
    dropout: float = 0.0,
) -> nn.Sequential:
    layers = []
    cur_dim = in_dim
    for _ in range(max(num_layers - 1, 0)):
        layers.append(nn.Linear(cur_dim, hidden_dim))
        layers.append(nn.ReLU())
        layers.append(nn.Dropout(dropout))
        cur_dim = hidden_dim
    layers.append(nn.Linear(cur_dim, out_dim))
    return nn.Sequential(*layers)


class GraphEncoder(nn.Module):
    def __init__(
        self,
        node_dim: int,
        edge_dim: int,
        hidden_dim: int = 128,
        num_layers: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.dropout = dropout
        self.node_proj = nn.Linear(node_dim, hidden_dim)
        self.edge_proj = nn.Linear(edge_dim, hidden_dim)
        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()

        for _ in range(num_layers):
            conv_mlp = build_mlp(hidden_dim, hidden_dim, hidden_dim, num_layers=2, dropout=dropout)
            self.convs.append(GINEConv(conv_mlp, edge_dim=hidden_dim))
            self.norms.append(nn.BatchNorm1d(hidden_dim))

        self.out_dim = hidden_dim * 2

    def forward(self, data):
        x = self.node_proj(data.x)
        edge_attr = self.edge_proj(data.edge_attr)

        for conv, norm in zip(self.convs, self.norms):
            h = conv(x, data.edge_index, edge_attr)
            h = norm(h)
            h = F.relu(h)
            h = F.dropout(h, p=self.dropout, training=self.training)
            x = x + h

        g_mean = global_mean_pool(x, data.batch)
        g_max = global_max_pool(x, data.batch)
        return torch.cat([g_mean, g_max], dim=-1)


class CrossGraphFusion(nn.Module):
    def __init__(self, graph_dim: int, hidden_dim: int, dropout: float):
        super().__init__()
        self.pre_gate = nn.Sequential(
            nn.Linear(graph_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, graph_dim),
            nn.Sigmoid(),
        )
        self.post_gate = nn.Sequential(
            nn.Linear(graph_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, graph_dim),
            nn.Sigmoid(),
        )

    def forward(self, g_pre, g_post):
        pair = torch.cat([g_pre, g_post], dim=-1)
        gate_pre = self.pre_gate(pair)
        gate_post = self.post_gate(pair)
        g_pre = gate_pre * g_pre
        g_post = gate_post * g_post
        return torch.cat([g_pre, g_post, torch.abs(g_pre - g_post), g_pre * g_post], dim=-1)


class FeatureEncoder(nn.Module):
    def __init__(self, in_dim: int, hidden_dim: int, dropout: float):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
        )

    def forward(self, x):
        return self.net(x)


class DualGraphFidelityNet(nn.Module):
    """
    分离建模版本：
    - 主干网络不接收shots，只处理circuit和noise特征
    - 输出三个参数: f_inf (收敛fidelity), theta (收敛速度), log_c (variance常数)
    - 用公式计算:
        g = shots / (shots + theta)      # 折扣因子，单调递增
        mean = f_inf * g                  # fidelity预测
        logvar = log_c - log(shots)       # variance，单调递减
    """
    def __init__(
        self,
        node_dim: int,
        edge_dim: int,
        shot_dim: int,  # 保留参数以兼容旧checkpoint加载，但不再使用
        backend_dim: int,
        circuit_dim: int,
        graph_attr_dim: int,
        hidden_dim: int = 128,
        gnn_layers: int = 4,
        dropout: float = 0.1,
        predict_uncertainty: bool = True,
    ):
        super().__init__()
        self.predict_uncertainty = predict_uncertainty
        self.hidden_dim = hidden_dim

        # Graph encoders
        self.pre_encoder = GraphEncoder(
            node_dim=node_dim,
            edge_dim=edge_dim,
            hidden_dim=hidden_dim,
            num_layers=gnn_layers,
            dropout=dropout,
        )
        self.post_encoder = GraphEncoder(
            node_dim=node_dim,
            edge_dim=edge_dim,
            hidden_dim=hidden_dim,
            num_layers=gnn_layers,
            dropout=dropout,
        )

        graph_emb_dim = self.pre_encoder.out_dim
        fused_graph_dim = graph_emb_dim * 4

        self.graph_fusion = CrossGraphFusion(graph_emb_dim, hidden_dim=hidden_dim, dropout=dropout)
        
        # Feature encoders (不再需要shot_encoder)
        self.graph_attr_encoder = FeatureEncoder(graph_attr_dim, hidden_dim=hidden_dim, dropout=dropout)
        self.backend_encoder = FeatureEncoder(backend_dim, hidden_dim=hidden_dim, dropout=dropout)
        self.circuit_encoder = FeatureEncoder(circuit_dim, hidden_dim=hidden_dim, dropout=dropout)

        # 主干网络：不包含shot特征
        # total_dim = fused_graph_dim + hidden_dim * 3 (去掉了shot_encoder的hidden_dim)
        total_dim = fused_graph_dim + hidden_dim * 3
        
        self.backbone = nn.Sequential(
            nn.Linear(total_dim, hidden_dim * 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # 三个输出头
        # f_inf: 收敛fidelity，范围 [0, 1]
        self.f_inf_head = nn.Linear(hidden_dim, 1)
        
        # theta: 半饱和shots，范围 > 0
        self.theta_head = nn.Linear(hidden_dim, 1)
        
        # log_c: log(variance常数)，用于计算 logvar = log_c - log(shots)
        self.log_c_head = nn.Linear(hidden_dim, 1)

    def forward(self, pre_data, post_data, shots, backend_feat, circuit_feat, graph_attr_feat):
        """
        Args:
            pre_data: 预处理前的circuit graph batch
            post_data: 预处理后的circuit graph batch
            shots: 原始shots值，shape (batch_size,) 或 (batch_size, 1)
            backend_feat: backend特征，shape (batch_size, backend_dim)
            circuit_feat: circuit特征，shape (batch_size, circuit_dim)
            graph_attr_feat: graph属性特征，shape (batch_size, graph_attr_dim)
            
        Returns:
            mean: 预测的fidelity，shape (batch_size,)
            logvar: 预测的log variance，shape (batch_size,) [仅当predict_uncertainty=True]
        """
        # 确保shots是正确的shape
        if shots.dim() == 1:
            shots = shots.unsqueeze(-1)  # (batch_size,) -> (batch_size, 1)
        shots = shots.float()
        
        # 1. 图编码（与circuit和noise相关，与shots无关）
        g_pre = self.pre_encoder(pre_data)
        g_post = self.post_encoder(post_data)
        g_pair = self.graph_fusion(g_pre, g_post)

        # 2. 特征编码（不包含shots）
        backend_z = self.backend_encoder(backend_feat)
        circuit_z = self.circuit_encoder(circuit_feat)
        graph_attr_z = self.graph_attr_encoder(graph_attr_feat)

        # 3. 主干网络
        h = torch.cat([g_pair, backend_z, circuit_z, graph_attr_z], dim=-1)
        h = self.backbone(h)

        # 4. 预测三个参数
        # f_inf: 使用sigmoid确保在[0, 1]范围
        f_inf = torch.sigmoid(self.f_inf_head(h))  # (batch_size, 1)
        
        # theta: 使用softplus确保 > 0，加上最小值防止数值问题
        # theta表示半饱和shots，典型值可能在几十到几百
        theta = F.softplus(self.theta_head(h)) + 1.0  # (batch_size, 1)，最小值为1
        
        # log_c: 无约束
        log_c = self.log_c_head(h)  # (batch_size, 1)

        # 5. 用公式计算mean和logvar
        # g = shots / (shots + theta)，范围 [0, 1)，随shots单调递增
        g = shots / (shots + theta)
        
        # mean = f_inf * g，天然单调递增（因为g单调递增）
        mean = (f_inf * g).squeeze(-1)  # (batch_size,)
        
        if self.predict_uncertainty:
            # logvar = log_c - log(shots)
            # var = c / shots，天然单调递减
            logvar = (log_c - torch.log(shots)).squeeze(-1)  # (batch_size,)
            return mean, logvar
        
        return mean

    def predict_curve_params(self, pre_data, post_data, backend_feat, circuit_feat, graph_attr_feat):
        """
        只预测曲线参数，不需要shots输入。
        用于推理时一次性获取参数，然后对任意shots计算fidelity。
        
        Returns:
            f_inf: 收敛fidelity，shape (batch_size,)
            theta: 半饱和shots，shape (batch_size,)
            log_c: log(variance常数)，shape (batch_size,)
        """
        # 图编码
        g_pre = self.pre_encoder(pre_data)
        g_post = self.post_encoder(post_data)
        g_pair = self.graph_fusion(g_pre, g_post)

        # 特征编码
        backend_z = self.backend_encoder(backend_feat)
        circuit_z = self.circuit_encoder(circuit_feat)
        graph_attr_z = self.graph_attr_encoder(graph_attr_feat)

        # 主干网络
        h = torch.cat([g_pair, backend_z, circuit_z, graph_attr_z], dim=-1)
        h = self.backbone(h)

        # 预测参数
        f_inf = torch.sigmoid(self.f_inf_head(h)).squeeze(-1)
        theta = (F.softplus(self.theta_head(h)) + 1.0).squeeze(-1)
        log_c = self.log_c_head(h).squeeze(-1)

        return f_inf, theta, log_c

    @staticmethod
    def compute_fidelity(shots, f_inf, theta):
        """
        给定曲线参数，计算任意shots的fidelity。
        
        Args:
            shots: shots值，可以是标量、1D tensor或任意shape
            f_inf: 收敛fidelity
            theta: 半饱和shots
            
        Returns:
            fidelity: 预测的fidelity，shape与shots相同
        """
        shots = torch.as_tensor(shots, dtype=torch.float32)
        g = shots / (shots + theta)
        return f_inf * g

    @staticmethod
    def compute_variance(shots, log_c):
        """
        给定曲线参数，计算任意shots的variance。
        
        Args:
            shots: shots值
            log_c: log(variance常数)
            
        Returns:
            variance: 预测的variance
        """
        shots = torch.as_tensor(shots, dtype=torch.float32)
        return torch.exp(log_c) / shots

    @staticmethod
    def compute_logvar(shots, log_c):
        """
        给定曲线参数，计算任意shots的log variance。
        """
        shots = torch.as_tensor(shots, dtype=torch.float32)
        return log_c - torch.log(shots)