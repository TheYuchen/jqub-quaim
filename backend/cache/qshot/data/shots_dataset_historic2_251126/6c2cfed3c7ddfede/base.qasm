OPENQASM 3.0;
include "stdgates.inc";
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
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
qubit[5] q;
rzz(3.069425658845041) q[3], q[2];
h q[0];
dcx q[1], q[4];
tdg q[0];
h q[4];
p(0.9430817767285194) q[3];
cp(5.174439099035316) q[2], q[1];
u1(1.0853298377478935) q[0];
s q[2];
xx_plus_yy(4.856508361652386, 5.5527772588154685) q[1], q[4];
y q[3];
p(2.1917494802855515) q[4];
swap q[3], q[2];
rxx(2.3939840279727553) q[1], q[0];
sxdg q[1];
x q[3];
rz(4.419197268952041) q[2];
cu3(4.375762521484453, 6.086406539572896, 1.2121962041155867) q[4], q[0];
sx q[4];
cs q[3], q[1];
y q[0];
rx(4.574429421666424) q[1];
cp(4.638639962063937) q[0], q[3];
x q[2];
ccx q[3], q[2], q[1];
r(5.615384942880005, 5.7768595118760295) q[4];
sdg q[0];
cu3(3.7151872653940945, 4.54710283106115, 5.512085909383537) q[2], q[4];
ry(3.8309264236143123) q[1];
ecr q[3], q[0];
ecr q[0], q[3];
p(1.8930903441723803) q[4];
ry(5.343221188277844) q[1];
