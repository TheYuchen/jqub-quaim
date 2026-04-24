OPENQASM 3.0;
include "stdgates.inc";
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
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
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
qubit[6] q;
rx(3.167520017980468) q[4];
iswap q[1], q[2];
p(1.6443855399028673) q[5];
s q[0];
s q[2];
csx q[5], q[1];
u2(2.363355612900069, 2.477757240421126) q[4];
ry(5.9479426833082485) q[0];
y q[3];
U(4.188417628897818, 5.248445428009232, 1.4249300822505893) q[1];
csdg q[5], q[3];
tdg q[2];
p(3.6123377263819787) q[4];
sx q[0];
