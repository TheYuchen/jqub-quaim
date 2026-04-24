OPENQASM 3.0;
include "stdgates.inc";
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[6] q;
cz q[1], q[2];
csdg q[3], q[5];
sx q[0];
ch q[2], q[0];
crz(3.4243369870683735) q[5], q[4];
r(1.893054364743946, 5.725601319311979) q[3];
swap q[5], q[4];
crx(3.898668770818193) q[3], q[1];
xx_minus_yy(1.792875575550191, 1.401005204514585) q[2], q[0];
cu1(2.0390132376317935) q[5], q[0];
ecr q[2], q[4];
cp(1.3055540481536745) q[3], q[1];
ry(1.6431755914124728) q[4];
id q[3];
rzx(3.1148763866091023) q[1], q[2];
cu(5.447158386562487, 1.2613773384417097, 3.4054846928199702, 4.159327156432241) q[0], q[5];
rz(4.414063875143614) q[1];
cu3(2.9216306639843936, 3.9653913344292677, 6.033068262731521) q[3], q[4];
dcx q[5], q[0];
cz q[3], q[1];
rxx(1.472059806480194) q[2], q[0];
cp(2.7867700871059746) q[5], q[4];
cs q[4], q[0];
csdg q[1], q[3];
rx(3.779048062146456) q[5];
cry(3.4202513673025936) q[4], q[1];
ecr q[5], q[2];
p(3.9791891665887316) q[3];
r(5.2982329267128305, 4.538192928538008) q[1];
iswap q[2], q[5];
swap q[4], q[0];
swap q[1], q[5];
cy q[2], q[0];
rzx(3.7224924271172504) q[4], q[3];
cy q[1], q[4];
cy q[2], q[0];
crx(3.1233988229793317) q[5], q[3];
u2(1.7174709509259192, 2.5862999119239074) q[1];
ecr q[0], q[3];
xx_minus_yy(3.586148440637874, 0.3578398185449765) q[5], q[4];
cz q[3], q[4];
csdg q[0], q[2];
cx q[1], q[5];
csx q[1], q[0];
cp(4.361921703755574) q[4], q[5];
rx(1.975776974316011) q[3];
u1(5.586936824131834) q[2];
