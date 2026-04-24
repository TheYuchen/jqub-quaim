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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate xx_plus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(p1) _gate_q_0;
  sdg _gate_q_1;
  sx _gate_q_1;
  s _gate_q_1;
  s _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  ry((-0.5)*p0) _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  sdg _gate_q_0;
  sdg _gate_q_1;
  sxdg _gate_q_1;
  s _gate_q_1;
  rz(-p1) _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[8] q;
rccx q[0], q[4], q[3];
ryy(6.0593840052383925) q[6], q[2];
x q[1];
ry(2.4333483463916044) q[7];
p(2.703081364546595) q[4];
ccx q[2], q[3], q[7];
cry(0.3035529113181406) q[0], q[6];
dcx q[5], q[1];
ccx q[7], q[6], q[2];
cp(2.7846493445222795) q[5], q[4];
ecr q[3], q[0];
h q[1];
cswap q[4], q[0], q[2];
t q[5];
p(5.840491889721634) q[1];
ccz q[3], q[6], q[7];
ccx q[4], q[0], q[1];
xx_plus_yy(0.19727831198637374, 2.771524561744926) q[5], q[3];
rx(4.636189148317191) q[6];
ccz q[5], q[0], q[1];
ccz q[7], q[6], q[3];
u2(4.679313354026787, 4.694237902302768) q[4];
cswap q[2], q[4], q[5];
r(4.865683823621258, 1.5635251742228653) q[3];
rccx q[0], q[7], q[6];
r(2.4450590394522225, 3.609194064075186) q[1];
rccx q[6], q[2], q[7];
rccx q[4], q[3], q[1];
xx_plus_yy(5.191013188902669, 5.057022468613194) q[0], q[5];
rz(1.3935518843442067) q[6];
u3(0.9495831458942505, 2.423716491104536, 2.5483169556899323) q[2];
ccx q[7], q[5], q[0];
ccz q[1], q[3], q[4];
sxdg q[4];
cp(3.7480825807892297) q[5], q[3];
y q[2];
cswap q[6], q[0], q[1];
t q[7];
