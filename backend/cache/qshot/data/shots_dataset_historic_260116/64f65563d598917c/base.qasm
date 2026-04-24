OPENQASM 3.0;
include "stdgates.inc";
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
rzz(0.06534032651626245) q[0], q[2];
swap q[1], q[4];
cu(0.009540097321214783, 2.0554221668276815, 1.907348590920034, 1.8961606254117078) q[6], q[3];
h q[5];
rxx(1.3473565285624596) q[1], q[0];
cu(2.0794276249181927, 4.506832702377124, 4.369873080266131, 5.188890579760527) q[3], q[2];
csdg q[5], q[4];
cp(4.761383339744487) q[4], q[2];
xx_minus_yy(1.0337498400754348, 1.267255756527605) q[0], q[5];
csdg q[6], q[3];
cry(3.250837382042049) q[1], q[2];
cp(0.06660228036050565) q[5], q[3];
cs q[4], q[0];
xx_minus_yy(3.300770080267058, 2.4248451760471976) q[5], q[1];
ch q[4], q[6];
iswap q[3], q[2];
ch q[5], q[1];
iswap q[3], q[4];
ecr q[6], q[2];
cs q[3], q[4];
cx q[5], q[0];
ryy(2.9081344917038163) q[6], q[2];
cu1(6.027421390676849) q[4], q[5];
ryy(0.2779341092942103) q[6], q[1];
xx_plus_yy(4.297786378326861, 2.5869663219759977) q[3], q[0];
cp(6.134614634178826) q[6], q[3];
xx_minus_yy(2.275668444914113, 2.152740051765621) q[2], q[4];
cs q[5], q[1];
cp(6.07397077790452) q[0], q[3];
crx(3.026694999042803) q[2], q[6];
ryy(1.9241425034928898) q[5], q[1];
cu(0.7909754878585386, 5.460028918947686, 2.2244543120487297, 4.070209902945954) q[1], q[0];
ch q[4], q[2];
cu3(6.206646647662321, 1.0646056573248246, 3.5160334012503083) q[6], q[3];
csx q[4], q[2];
xx_plus_yy(2.951790270415097, 5.808543152135265) q[1], q[0];
ch q[5], q[3];
csx q[5], q[3];
rzz(4.387129295891837) q[1], q[6];
cx q[0], q[4];
swap q[0], q[4];
crz(4.002656554987674) q[3], q[2];
ecr q[1], q[6];
cu1(0.702460782870565) q[6], q[2];
ryy(4.945386723785233) q[5], q[3];
cz q[4], q[1];
