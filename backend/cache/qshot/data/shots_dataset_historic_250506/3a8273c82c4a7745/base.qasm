OPENQASM 3.0;
include "stdgates.inc";
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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
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
xx_minus_yy(0.3322475331133763, 3.773767843826343) q[5], q[3];
crx(1.6388243453262168) q[7], q[2];
p(3.3322071955705788) q[1];
x q[4];
r(3.343768361424466, 2.2304988744115857) q[0];
rz(5.015289573455155) q[6];
ecr q[3], q[7];
sdg q[2];
t q[4];
csx q[0], q[1];
cz q[5], q[6];
xx_minus_yy(4.857289704017482, 3.5298374188267148) q[0], q[4];
cu3(3.4056304746054167, 2.1892131124736363, 0.03155414905515689) q[3], q[2];
rzz(1.529398001754171) q[7], q[6];
cp(2.4169653316837976) q[1], q[5];
xx_minus_yy(1.6966918533049324, 1.2732775616346825) q[1], q[6];
u3(1.0573367888180831, 6.082157824846893, 1.7487628412107912) q[3];
cu3(4.684952288383622, 4.495130449115592, 1.3247403164440383) q[4], q[0];
rxx(2.7070352952836867) q[5], q[2];
rx(4.806973458713169) q[7];
rzz(2.2167870366309517) q[5], q[0];
rz(4.777303689186287) q[3];
csx q[7], q[1];
u2(1.1486106253831, 4.754380559409383) q[2];
crz(1.5540046439126614) q[4], q[6];
sx q[6];
sx q[1];
u3(3.255566374831431, 1.8485217840293187, 1.2347145521214764) q[4];
ecr q[3], q[5];
cry(2.1873654510155585) q[2], q[0];
u2(0.15534220671896254, 2.398774686691968) q[7];
z q[1];
ryy(0.14902272204315511) q[5], q[3];
cz q[4], q[2];
xx_plus_yy(4.408625296709386, 1.7292853286796424) q[6], q[7];
sx q[0];
cx q[1], q[7];
ecr q[2], q[4];
cry(4.237688698618544) q[0], q[5];
crz(0.32975779218729356) q[3], q[6];
