OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[8] q;
cs q[6], q[4];
ryy(1.0818919896689592) q[5], q[1];
x q[2];
cu(6.233779949643176, 2.784025037682679, 4.4843202809029545, 4.848844056512041) q[3], q[0];
xx_plus_yy(5.026350030591993, 3.4178359769739775) q[3], q[7];
h q[2];
cu3(0.5305601587165774, 5.4419520411881495, 1.8627508114317382) q[0], q[6];
crz(5.219775104771339) q[5], q[4];
cu(4.246554454833482, 1.0311737839165995, 5.851865033527387, 2.2771202905946706) q[2], q[1];
tdg q[7];
ch q[5], q[0];
xx_minus_yy(3.6956167084153844, 5.993019554766243) q[6], q[4];
cz q[6], q[2];
U(3.952075465243056, 0.9284111535007968, 1.831257145916562) q[3];
rzx(4.447377487717261) q[5], q[4];
dcx q[0], q[7];
swap q[7], q[2];
r(5.203672397762702, 0.20156391649913835) q[6];
cp(1.8657749165728712) q[3], q[1];
crz(3.1063547563759957) q[4], q[0];
iswap q[0], q[2];
h q[7];
x q[5];
ry(3.0564048995691806) q[4];
crx(3.844662505648858) q[1], q[3];
ecr q[0], q[2];
cz q[3], q[1];
cp(2.1659466945066352) q[6], q[4];
iswap q[5], q[7];
cp(1.6232138338216213) q[6], q[4];
xx_plus_yy(5.953669513249702, 2.1221186342434315) q[3], q[7];
rx(3.8858859513785466) q[0];
crx(1.2487733299604076) q[2], q[5];
csx q[1], q[6];
cs q[5], q[7];
dcx q[2], q[0];
rzx(1.435683497838292) q[4], q[3];
cx q[7], q[4];
swap q[0], q[1];
cu(3.054375855736762, 4.6318519448119995, 3.3561086130219935, 0.9511303205946279) q[2], q[3];
crz(0.3329482048704886) q[5], q[6];
