OPENQASM 3.0;
include "stdgates.inc";
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
qubit[7] q;
ecr q[0], q[5];
y q[3];
sxdg q[6];
rz(5.480514639352647) q[4];
p(0.08912266075587522) q[1];
sdg q[2];
U(4.195971319687066, 6.025959347080436, 5.540240390468279) q[4];
cy q[6], q[3];
cy q[0], q[2];
cry(5.023191188629788) q[5], q[1];
t q[2];
iswap q[1], q[5];
dcx q[4], q[0];
rz(5.6799310467872415) q[3];
