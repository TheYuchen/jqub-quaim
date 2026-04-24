OPENQASM 3.0;
include "stdgates.inc";
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
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
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
qubit[5] q;
rz(5.845347642786711) q[0];
sx q[1];
ccx q[2], q[3], q[4];
cswap q[0], q[2], q[3];
csdg q[1], q[4];
ryy(1.3577407601494234) q[3], q[4];
cry(5.751360187349181) q[0], q[1];
rz(3.543211711848397) q[2];
crz(2.5657793699464073) q[0], q[3];
ccx q[1], q[2], q[4];
rccx q[3], q[4], q[2];
u2(2.224711621718366, 2.1485354454611523) q[0];
tdg q[1];
cswap q[1], q[4], q[2];
u3(3.9056591593477923, 3.5480020866503965, 0.06487557496799444) q[3];
id q[3];
h q[4];
ccz q[0], q[2], q[1];
cswap q[4], q[0], q[2];
sx q[3];
