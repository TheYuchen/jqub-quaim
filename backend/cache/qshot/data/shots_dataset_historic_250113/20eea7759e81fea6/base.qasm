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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
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
qubit[6] q;
ccz q[2], q[0], q[3];
z q[5];
cry(4.197471693008969) q[4], q[1];
ryy(5.7815322986289415) q[2], q[5];
crx(3.3176439156056605) q[0], q[4];
xx_minus_yy(3.482716063740334, 0.41730099924408914) q[1], q[3];
cswap q[1], q[0], q[2];
sx q[3];
u3(5.287082127059798, 3.412975615348487, 2.706477500381303) q[5];
id q[4];
ccz q[4], q[2], q[3];
id q[0];
ryy(4.254292539032868) q[5], q[1];
z q[3];
cy q[5], q[0];
h q[2];
csx q[4], q[1];
cu1(4.9129545393553515) q[4], q[0];
u1(2.2467559905954926) q[1];
csdg q[2], q[3];
tdg q[5];
rz(2.1520711418899032) q[1];
cz q[0], q[4];
rxx(4.685141113539363) q[2], q[5];
sx q[3];
xx_minus_yy(3.0957549291290913, 5.304940264886765) q[0], q[4];
cp(4.798698794604302) q[1], q[3];
ry(1.948062393641996) q[2];
ry(6.050943323283465) q[5];
