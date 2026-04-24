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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
qubit[7] q;
u1(4.226585507070504) q[2];
u1(0.8462880152379942) q[5];
rz(5.656596555247161) q[3];
ryy(3.2806980230257485) q[4], q[6];
u3(5.992908211204684, 2.613408896538708, 2.4505093383051064) q[1];
u2(0.40062398370303237, 1.827656995862224) q[0];
x q[5];
cz q[4], q[2];
h q[0];
s q[1];
z q[3];
p(0.21158024430153669) q[2];
id q[4];
u1(3.955398237224943) q[1];
z q[6];
rzx(5.028546149880083) q[0], q[5];
sdg q[3];
xx_minus_yy(4.1261711641935355, 1.2863381212239857) q[6], q[5];
ry(3.914547117791888) q[1];
cu3(3.1761018552017926, 2.7178723976308063, 1.974130815519121) q[0], q[4];
r(0.037271606625440726, 3.352448269247582) q[3];
ry(0.17646352399648685) q[2];
tdg q[2];
ryy(3.147578120888767) q[1], q[5];
sx q[6];
ecr q[4], q[0];
rz(0.18543567132199754) q[3];
s q[4];
sxdg q[0];
id q[6];
sx q[2];
sdg q[5];
u1(0.20611977192908487) q[3];
sdg q[1];
ecr q[1], q[6];
z q[3];
r(5.064923933822794, 6.160633877695315) q[2];
r(4.464106973299202, 1.7631162263968576) q[4];
y q[5];
ch q[4], q[2];
id q[3];
r(5.395630236870088, 2.008817519106737) q[6];
sdg q[0];
cp(5.491510715741572) q[1], q[5];
