OPENQASM 3.0;
include "stdgates.inc";
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
qubit[7] q;
cz q[0], q[1];
t q[3];
sxdg q[4];
h q[6];
u1(3.853920281310875) q[2];
x q[5];
z q[6];
cx q[5], q[0];
p(2.7405912734866944) q[1];
u1(0.5343804192797477) q[3];
p(0.3326053773457779) q[4];
rz(2.8149067098330316) q[2];
y q[4];
rz(4.39557516197483) q[0];
r(5.42276611129538, 0.8419648182806508) q[2];
sxdg q[6];
h q[3];
sdg q[1];
sdg q[5];
sdg q[2];
r(4.385470731187086, 3.716065430465032) q[1];
rccx q[4], q[0], q[3];
ry(0.5617332327443834) q[6];
xx_minus_yy(1.673627827710181, 1.1799924316037274) q[4], q[3];
csx q[5], q[1];
sx q[0];
s q[2];
sx q[6];
r(2.1363016918096966, 2.0304977968740503) q[1];
u3(0.15896857414749752, 0.1614684102352066, 1.827155743215419) q[0];
p(4.5641595512568855) q[4];
p(3.426693464931545) q[3];
r(6.12727267675687, 3.4215969104870436) q[2];
id q[5];
sx q[6];
u1(4.921086194062684) q[3];
swap q[2], q[1];
tdg q[4];
cu(4.695317140891584, 2.3667386865720252, 5.0928935651757845, 5.09233153294269) q[6], q[5];
u2(0.5648877514617063, 2.851939116086461) q[0];
p(3.262459489238834) q[0];
h q[3];
rx(1.244309040863817) q[6];
cswap q[4], q[2], q[1];
t q[5];
r(3.444451009074409, 3.431204590384695) q[6];
z q[1];
ryy(1.8901834879890602) q[4], q[0];
ccz q[3], q[2], q[5];
sdg q[5];
id q[1];
ry(1.7307980386354787) q[4];
rccx q[6], q[3], q[0];
u3(6.196486778740096, 1.931368981709534, 5.055311880549043) q[2];
