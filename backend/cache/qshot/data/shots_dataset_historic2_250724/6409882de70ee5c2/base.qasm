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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[6] q;
cy q[2], q[4];
U(4.126529267446332, 2.662993925899669, 2.637664443223414) q[0];
cswap q[3], q[1], q[5];
cp(0.637603035348673) q[0], q[1];
ccz q[4], q[5], q[2];
rz(0.48609710643060916) q[3];
z q[0];
xx_minus_yy(3.941757100611429, 0.9874889012594633) q[3], q[2];
rzz(4.950631896814623) q[1], q[5];
csdg q[4], q[3];
cu3(0.33273479973027276, 5.898325357655226, 2.022947182252045) q[5], q[1];
cp(1.2570783148093643) q[2], q[0];
cu3(0.06485692354873933, 4.49092623429587, 2.334810493608013) q[2], q[4];
sdg q[5];
rccx q[1], q[3], q[0];
cu(0.046912782062542326, 0.6214302923181352, 4.98399823408006, 4.5519066921731675) q[0], q[3];
rz(0.05339514011889492) q[4];
cu3(0.7022818229625937, 4.451384096169874, 1.6969707721519722) q[1], q[2];
t q[5];
crx(3.6337799824959016) q[4], q[2];
s q[3];
u1(0.5613462560657383) q[1];
crz(1.8162329081658777) q[5], q[0];
xx_plus_yy(0.4011017958434919, 2.1691595835443773) q[5], q[0];
ryy(1.6006748593545124) q[4], q[3];
tdg q[1];
sdg q[2];
cry(0.7391986612698822) q[4], q[5];
ch q[3], q[0];
cu(3.557881746566991, 0.3216538453491565, 1.7953140221277493, 1.152138503102306) q[1], q[2];
cswap q[0], q[1], q[3];
u1(0.6851633210783508) q[5];
ryy(5.168349853362746) q[5], q[2];
cu3(5.881542674780728, 2.65346901428647, 4.96256088586895) q[3], q[0];
h q[1];
id q[4];
ccx q[5], q[0], q[1];
cp(5.248294284398575) q[4], q[2];
tdg q[3];
rzx(4.478584761009242) q[3], q[0];
cu(5.026092234183363, 0.9782218673178773, 3.882539086091658, 0.14096696306830042) q[2], q[4];
z q[5];
cswap q[4], q[3], q[0];
cu(3.99326444680905, 1.2403144380835156, 2.4395319100360715, 0.7702713144089989) q[1], q[4];
id q[0];
cswap q[2], q[5], q[3];
