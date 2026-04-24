OPENQASM 3.0;
include "stdgates.inc";
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate xx_minus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(-p1) _gate_q_1;
  sdg _gate_q_0;
  sx _gate_q_0;
  s _gate_q_0;
  s _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  ry(0.5*p0) _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sdg _gate_q_1;
  sdg _gate_q_0;
  sxdg _gate_q_0;
  s _gate_q_0;
  rz(p1) _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
qubit[7] q;
ccz q[0], q[6], q[1];
crx(2.313635487495346) q[2], q[3];
sxdg q[5];
t q[4];
cz q[5], q[2];
tdg q[3];
u3(0.26438020463988454, 0.1360950771001919, 1.7939551789170598) q[4];
cz q[0], q[1];
rz(0.07647657329346144) q[6];
xx_plus_yy(3.855868187939074, 4.190117620376198) q[0], q[1];
rx(2.8583276544676623) q[4];
ccz q[5], q[2], q[6];
swap q[1], q[5];
cp(1.9548018475742075) q[0], q[6];
s q[3];
iswap q[4], q[2];
csdg q[6], q[0];
rz(1.9454470912653417) q[2];
cswap q[3], q[4], q[5];
y q[1];
tdg q[4];
cx q[2], q[0];
cu3(1.6819999806756158, 3.3435470329876, 1.9475647293890939) q[6], q[5];
u2(2.24146123703932, 1.7429981667341459) q[3];
h q[5];
ccx q[1], q[3], q[0];
xx_minus_yy(2.848764811412557, 5.468997255747355) q[4], q[2];
y q[6];
tdg q[0];
cu(2.1183832059132106, 6.035563963933117, 0.41089539384270635, 0.688583401214863) q[4], q[1];
s q[3];
cz q[2], q[5];
u3(1.139602010009886, 3.4609002702277007, 3.566947408553943) q[6];
id q[4];
r(4.647876040445168, 3.2929581504819474) q[6];
ccx q[5], q[2], q[0];
tdg q[1];
dcx q[4], q[2];
iswap q[6], q[3];
csx q[0], q[1];
cz q[5], q[3];
ry(1.7385899548190844) q[1];
cp(1.4285938325154206) q[4], q[0];
r(5.518880860341117, 1.9419793172845743) q[6];
cz q[2], q[1];
crx(4.251638013136113) q[5], q[6];
rccx q[4], q[3], q[0];
cswap q[2], q[6], q[4];
csx q[1], q[5];
U(2.041278366649571, 3.4562139074969696, 1.042836881949139) q[3];
cp(0.04808591712225638) q[2], q[5];
id q[3];
s q[6];
y q[4];
dcx q[0], q[1];
ry(3.177770054590275) q[0];
cp(0.8666436017233715) q[2], q[1];
ccz q[5], q[3], q[6];
