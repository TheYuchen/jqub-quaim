OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[6] q;
rz(1.4816102549492638) q[3];
cz q[2], q[4];
swap q[0], q[1];
rz(0.5377217015683025) q[5];
y q[2];
csx q[1], q[3];
rzz(1.668906378220927) q[0], q[5];
sdg q[4];
rx(6.137780083191542) q[4];
h q[5];
csx q[2], q[3];
id q[1];
sxdg q[0];
cy q[5], q[4];
swap q[2], q[3];
tdg q[1];
r(4.381425816921125, 3.937623371865188) q[0];
rx(2.9966911962322333) q[4];
p(2.1005738803883105) q[2];
y q[5];
u2(0.19738686524042764, 2.7903587848078684) q[3];
