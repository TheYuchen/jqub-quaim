OPENQASM 3.0;
include "stdgates.inc";
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
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
qubit[7] q;
z q[2];
ryy(2.338495988601894) q[1], q[5];
csx q[4], q[0];
crx(2.393251027226589) q[6], q[3];
rxx(0.8859849530596743) q[2], q[3];
crz(0.0387291206410104) q[4], q[1];
rzz(3.2145526641397963) q[6], q[5];
h q[0];
ch q[6], q[1];
u3(4.742047675840113, 2.458193278590203, 6.073698756890926) q[4];
csdg q[3], q[0];
rz(1.7465057680238527) q[5];
rz(3.5482176940644) q[2];
x q[5];
cz q[3], q[1];
ecr q[2], q[6];
ry(2.621176462387078) q[4];
rzz(0.15770540493765664) q[6], q[0];
s q[3];
sxdg q[2];
cz q[4], q[5];
u2(5.5820630970644425, 4.213767570925957) q[1];
h q[0];
sx q[2];
ry(5.387946693831218) q[4];
cp(4.193695796009368) q[5], q[6];
U(2.1396269423691234, 2.6810505224157133, 4.25691985414821) q[1];
r(5.921085903839338, 5.934753907655726) q[3];
s q[1];
u3(4.072512446701276, 1.3378353113177093, 2.026871419273837) q[5];
cy q[0], q[4];
z q[2];
s q[3];
rx(4.956753289762621) q[6];
tdg q[5];
id q[1];
p(1.228358110065516) q[6];
cry(1.1126154109130357) q[2], q[4];
t q[3];
cu3(1.4930492434104803, 3.0906091110788823, 5.856206110935613) q[2], q[1];
u1(1.1020655933154688) q[6];
csx q[4], q[5];
u1(2.3884093872622882) q[0];
cp(1.5795966950621247) q[4], q[0];
ryy(2.2878035815087365) q[6], q[2];
csdg q[1], q[5];
ry(3.5284321837527814) q[3];
ecr q[2], q[6];
rxx(6.01470748588875) q[1], q[3];
rzx(5.985650552590855) q[0], q[5];
h q[4];
iswap q[3], q[5];
r(3.5614828898651973, 1.8182959563571253) q[0];
sx q[1];
ryy(3.0876124866355488) q[2], q[6];
u1(2.910329985656689) q[2];
swap q[0], q[3];
iswap q[6], q[1];
dcx q[4], q[5];
s q[0];
rzx(3.4937736600848512) q[1], q[5];
s q[6];
z q[4];
sxdg q[3];
u2(4.204660728364907, 3.241076439746117) q[5];
cx q[1], q[3];
cp(5.354933224292123) q[2], q[6];
rzx(4.36732321536343) q[0], q[4];
