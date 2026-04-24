OPENQASM 3.0;
include "stdgates.inc";
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
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
qubit[7] q;
rccx q[3], q[4], q[6];
ry(3.8701279066038623) q[0];
cswap q[2], q[5], q[1];
z q[1];
cu(4.181161935324339, 0.3410597178925704, 1.993852979004161, 3.0256659301891404) q[5], q[3];
csdg q[2], q[0];
y q[4];
sdg q[1];
sdg q[2];
ccz q[5], q[4], q[3];
U(3.7648864279958225, 2.5573976015549373, 2.648695036251892) q[0];
y q[6];
cp(2.2051401150720076) q[1], q[2];
y q[5];
rccx q[6], q[3], q[0];
cx q[0], q[2];
sx q[4];
cswap q[6], q[3], q[5];
rccx q[1], q[0], q[6];
tdg q[2];
ccz q[4], q[5], q[3];
ryy(5.1748423623952275) q[3], q[1];
cswap q[5], q[0], q[4];
id q[6];
rccx q[6], q[4], q[3];
rccx q[0], q[2], q[1];
sxdg q[5];
