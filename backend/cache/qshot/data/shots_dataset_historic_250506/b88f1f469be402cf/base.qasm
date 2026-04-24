OPENQASM 3.0;
include "stdgates.inc";
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
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
qubit[5] q;
s q[4];
ccz q[2], q[0], q[3];
rz(3.075946323114102) q[1];
ccx q[1], q[4], q[3];
cy q[2], q[0];
crx(2.820293518896618) q[1], q[4];
U(2.5393322530972577, 0.26167974044858505, 1.661688289234279) q[2];
rx(5.972252094324603) q[3];
s q[0];
z q[4];
U(3.841069225090896, 5.561680680872802, 4.224172233166779) q[2];
csx q[3], q[0];
z q[1];
x q[1];
ccz q[0], q[2], q[4];
s q[3];
