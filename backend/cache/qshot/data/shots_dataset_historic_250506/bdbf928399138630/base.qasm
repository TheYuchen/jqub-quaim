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
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[5] q;
cp(0.028400696511705115) q[2], q[0];
ccz q[1], q[4], q[3];
ccx q[4], q[3], q[0];
cs q[2], q[1];
crx(1.713926294875579) q[0], q[3];
csdg q[4], q[1];
ry(1.6187730702567027) q[2];
crx(3.5924208422956045) q[3], q[4];
cy q[2], q[1];
cp(6.050343764275345) q[0], q[4];
rzz(3.1975852201373054) q[2], q[3];
iswap q[0], q[1];
crx(4.540312656330849) q[4], q[2];
rzx(0.7527537557115297) q[4], q[3];
cz q[1], q[2];
swap q[0], q[3];
cz q[1], q[2];
