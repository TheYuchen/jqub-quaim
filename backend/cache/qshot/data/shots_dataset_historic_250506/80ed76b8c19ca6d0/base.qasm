OPENQASM 3.0;
include "stdgates.inc";
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate rccx _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  cx _gate_q_0, _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  h _gate_q_2;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[5] q;
h q[2];
rzx(6.013550735934423) q[3], q[4];
u1(5.575069197408469) q[0];
rccx q[1], q[0], q[2];
rx(4.76917065185023) q[3];
U(4.466369681037327, 2.5476986201795326, 5.140599418029118) q[4];
r(4.318604417504235, 2.4626753274956856) q[0];
p(0.6715335249499247) q[4];
id q[1];
rx(1.3427243115285132) q[2];
