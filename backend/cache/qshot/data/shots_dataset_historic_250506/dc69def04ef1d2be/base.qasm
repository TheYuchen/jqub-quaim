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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
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
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
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
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[5] q;
u2(1.7066691427774916, 1.5864543960638673) q[0];
ryy(3.1327185442908907) q[2], q[3];
crz(0.3733784433623012) q[4], q[1];
ecr q[4], q[1];
crz(3.4673406402888634) q[2], q[0];
sx q[3];
cu3(4.681880969466958, 0.26457230637013573, 5.975770580772744) q[2], q[1];
sxdg q[4];
cp(3.427597701225998) q[3], q[0];
z q[3];
rx(1.213137597839323) q[1];
x q[0];
z q[2];
xx_minus_yy(3.158060969719054, 6.085023636434773) q[3], q[1];
cs q[0], q[2];
tdg q[2];
rzx(6.205736662891206) q[1], q[4];
u3(0.9504277759396755, 6.015238898453187, 0.4700794461729668) q[0];
cu1(2.6266547003821463) q[4], q[1];
iswap q[0], q[2];
tdg q[3];
s q[1];
csdg q[0], q[2];
crz(5.007364574922147) q[4], q[3];
xx_minus_yy(0.17467070335388146, 1.481976310728142) q[1], q[0];
cy q[3], q[2];
u1(3.3292565117576656) q[4];
cs q[1], q[3];
ch q[0], q[2];
tdg q[4];
xx_plus_yy(0.41630746683677206, 2.9513489234373727) q[0], q[1];
cz q[4], q[2];
h q[3];
u3(4.019023562728962, 5.944952062414924, 2.9340052246865396) q[2];
cu1(4.658934011579477) q[1], q[4];
u1(6.031340423319918) q[3];
u2(0.7695194076957584, 3.419884453310668) q[0];
cz q[4], q[3];
tdg q[2];
id q[0];
sx q[1];
iswap q[3], q[2];
rxx(2.807461379528541) q[4], q[0];
x q[0];
csx q[4], q[2];
sdg q[3];
