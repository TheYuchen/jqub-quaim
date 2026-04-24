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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
qubit[8] q;
u2(4.121581178689172, 5.811098415579444) q[6];
t q[1];
t q[4];
U(6.002262581734508, 4.391457149187164, 0.00986455011570535) q[7];
iswap q[0], q[5];
r(4.134295942243046, 4.8943789459066105) q[3];
h q[6];
s q[0];
rzz(2.6790047154146626) q[5], q[7];
r(5.456202256967761, 2.9072802829671818) q[2];
id q[3];
rzz(0.9945479355140883) q[1], q[4];
h q[5];
rx(0.06535141842871342) q[7];
csdg q[0], q[6];
iswap q[1], q[2];
rxx(6.03558608033157) q[4], q[3];
