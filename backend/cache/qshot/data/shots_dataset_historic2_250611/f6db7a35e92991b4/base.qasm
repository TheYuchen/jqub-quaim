OPENQASM 3.0;
include "stdgates.inc";
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
qubit[6] q;
csdg q[3], q[0];
rxx(4.507014896668899) q[5], q[4];
id q[2];
h q[1];
x q[5];
h q[0];
h q[3];
csx q[2], q[1];
sx q[4];
cy q[0], q[1];
sdg q[3];
rx(2.9159111985493524) q[5];
tdg q[2];
x q[5];
cx q[3], q[4];
u1(5.687856909254724) q[1];
z q[0];
t q[2];
ryy(1.9269794226723325) q[3], q[2];
u2(2.203943073019821, 6.048068261334994) q[0];
dcx q[5], q[1];
cry(0.46832574785020303) q[2], q[3];
xx_minus_yy(2.820551990159776, 0.6138379695985735) q[0], q[5];
cs q[4], q[1];
cx q[3], q[5];
crz(5.239658413761317) q[0], q[1];
h q[2];
sxdg q[4];
crz(4.492371724860945) q[3], q[1];
id q[4];
cp(0.5766796590756236) q[2], q[5];
rz(1.8703904406614704) q[0];
rz(3.286360616599514) q[1];
ecr q[4], q[3];
rz(3.4776496222362856) q[0];
rx(2.6615878383931015) q[2];
rx(1.1761393789863857) q[3];
U(4.388335514502486, 2.5118789881492947, 1.9912041680684391) q[2];
cry(4.2708808459439815) q[1], q[5];
xx_plus_yy(1.3577404463809233, 3.7322790597999522) q[4], q[0];
u1(3.689775521498844) q[3];
csx q[0], q[5];
sx q[4];
sx q[2];
x q[5];
cx q[4], q[1];
ryy(1.6079362492671727) q[3], q[2];
s q[1];
crz(3.456868183592592) q[0], q[3];
swap q[4], q[5];
sxdg q[2];
dcx q[5], q[2];
u3(4.855408723147746, 0.9604310533505207, 5.454602296797532) q[4];
x q[1];
ch q[3], q[0];
sxdg q[0];
rzz(1.1554761327733087) q[1], q[3];
t q[2];
t q[4];
sxdg q[5];
