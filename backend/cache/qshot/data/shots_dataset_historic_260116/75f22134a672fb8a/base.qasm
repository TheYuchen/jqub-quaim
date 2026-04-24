OPENQASM 3.0;
include "stdgates.inc";
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
qubit[6] q;
cu3(1.6317364256397768, 6.084339296835601, 2.9492903459258084) q[0], q[2];
cs q[4], q[1];
sxdg q[5];
h q[3];
p(1.0403736178101046) q[5];
t q[1];
cz q[2], q[4];
s q[0];
r(0.5697956528355402, 3.2682738003078997) q[3];
cp(3.4438705600703696) q[3], q[4];
rx(6.250747986205275) q[1];
p(2.409868068044061) q[0];
rz(2.0626539165291433) q[2];
cp(0.12899675452776663) q[4], q[3];
iswap q[5], q[1];
id q[0];
crx(0.6845045741398278) q[5], q[4];
sdg q[2];
ecr q[1], q[0];
