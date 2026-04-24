OPENQASM 3.0;
include "stdgates.inc";
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
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
qubit[6] q;
y q[1];
crx(5.925428300826769) q[5], q[4];
ry(5.091985828084214) q[3];
x q[2];
sdg q[0];
r(3.0398602295148365, 0.19790828954991563) q[2];
r(1.045592023818703, 4.930548761126486) q[5];
r(1.0354474092621568, 5.9430431726803405) q[4];
z q[0];
U(3.9293014544929665, 1.8458947058402873, 5.872531738465872) q[1];
z q[4];
p(1.5623557258916299) q[5];
rx(4.9072801863314055) q[0];
sxdg q[1];
rxx(4.377930862502262) q[3], q[2];
rz(1.2575113951761543) q[5];
sxdg q[1];
y q[3];
csdg q[0], q[2];
h q[4];
rz(3.1573886418757042) q[5];
cx q[1], q[0];
p(0.5097534528491923) q[3];
sxdg q[4];
ry(5.996104615244618) q[2];
u3(2.5852143935562957, 1.2148539581926148, 5.730419044589345) q[4];
r(5.761088566898067, 2.100806953357972) q[5];
x q[2];
x q[0];
u2(5.736685893228363, 1.6469498035323915) q[1];
xx_minus_yy(4.7033246752814355, 0.9515384760589163) q[3], q[2];
xx_plus_yy(0.02775158879766404, 5.8153531228044475) q[1], q[5];
u3(0.9685964473275694, 2.0976813250838373, 2.7310557559669393) q[4];
sxdg q[0];
x q[1];
u3(4.058046986838606, 0.7878691990130663, 1.118400946601739) q[0];
z q[4];
y q[5];
sxdg q[3];
x q[2];
z q[4];
s q[2];
u3(2.241321655148646, 5.32184998876919, 6.270270563680997) q[3];
rx(2.985549780521426) q[0];
sdg q[5];
id q[1];
U(4.822080155181358, 3.920695837401933, 1.5324441750409978) q[3];
h q[0];
sx q[1];
csdg q[4], q[5];
t q[2];
