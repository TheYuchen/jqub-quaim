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
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
qubit[8] q;
crz(5.159522666290937) q[6], q[5];
u3(2.0491436038108004, 2.076521125560659, 1.1126479045940607) q[7];
h q[1];
rccx q[0], q[3], q[2];
y q[4];
U(5.124959621378849, 5.8833328401891505, 3.719384976504573) q[4];
r(1.432938774883078, 1.9994065123320202) q[2];
s q[6];
x q[3];
p(3.489333637044729) q[1];
r(4.303712892147301, 0.05201439208806694) q[5];
x q[7];
t q[0];
rzz(0.7219486826027858) q[0], q[6];
tdg q[1];
csdg q[3], q[7];
x q[4];
rxx(2.172931147640575) q[2], q[5];
cz q[7], q[0];
rx(1.775904651148774) q[1];
ccz q[2], q[6], q[3];
sx q[5];
s q[4];
U(3.8726511253958953, 3.6273692223881158, 3.7922034551680492) q[0];
u1(1.6853494743326596) q[6];
s q[4];
tdg q[3];
u3(2.6844673165212094, 2.9102595244598857, 0.6518753566076745) q[1];
u2(4.517020928767956, 1.7644924684525083) q[7];
u1(2.643814281279323) q[2];
U(2.3810595144544933, 3.6128659799955787, 5.413126063531767) q[5];
u1(6.152147754773909) q[0];
p(6.040251660894555) q[3];
cy q[7], q[1];
sx q[2];
ecr q[5], q[6];
rx(1.7969592592251835) q[4];
t q[7];
r(5.70434505472132, 4.528445432646996) q[6];
rz(5.081501679816996) q[5];
u2(0.36211612657041303, 3.5692809356783157) q[0];
y q[2];
z q[1];
rz(5.959758410838336) q[3];
sx q[4];
x q[3];
s q[5];
cx q[4], q[2];
xx_plus_yy(4.543563751355896, 2.1030930860992085) q[1], q[0];
sx q[6];
u3(0.7102057143731814, 3.484109373297343, 2.0720101531206923) q[7];
u3(3.8176562012347484, 1.727588996653615, 0.9572487501630778) q[4];
sdg q[3];
u1(2.8776122109467615) q[6];
cu1(3.5056846740086516) q[5], q[0];
u1(2.306264296600535) q[7];
crz(5.2866701914813925) q[1], q[2];
sxdg q[0];
ry(3.282824320794909) q[1];
y q[3];
sx q[6];
y q[7];
rxx(4.150191221099616) q[5], q[4];
z q[2];
