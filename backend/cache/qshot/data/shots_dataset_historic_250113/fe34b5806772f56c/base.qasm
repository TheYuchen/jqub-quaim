OPENQASM 3.0;
include "stdgates.inc";
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
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
qubit[8] q;
crz(3.009874476636105) q[0], q[3];
rzz(5.617757083560822) q[7], q[4];
rzx(0.9571729031859656) q[1], q[2];
ecr q[6], q[5];
dcx q[3], q[5];
s q[7];
ch q[4], q[1];
cry(5.755249477629859) q[0], q[2];
cz q[7], q[2];
rzz(4.105541769428687) q[4], q[5];
cz q[3], q[6];
cu(3.3778009480845257, 4.777592641864387, 3.770416732554131, 4.0698305411005276) q[0], q[1];
rzz(1.2169463441222377) q[3], q[6];
swap q[2], q[0];
rzx(0.01219277416563671) q[1], q[7];
xx_minus_yy(3.0774189308391198, 2.8182474734322756) q[4], q[5];
swap q[3], q[2];
ryy(5.1108532645251135) q[0], q[1];
cx q[4], q[6];
cs q[7], q[5];
crx(0.18236229110620245) q[1], q[6];
ecr q[3], q[5];
rzx(4.826766450038286) q[4], q[0];
xx_minus_yy(2.34081010653718, 0.8486704279475911) q[7], q[2];
rxx(2.852431779762421) q[6], q[3];
xx_minus_yy(2.874057557856348, 0.6011831434596838) q[5], q[4];
rzx(5.28746898935823) q[0], q[1];
iswap q[7], q[2];
crz(4.92509178942479) q[5], q[3];
xx_plus_yy(6.242597760294532, 4.112731744340243) q[4], q[0];
crz(0.29633500553450115) q[6], q[7];
cz q[2], q[1];
