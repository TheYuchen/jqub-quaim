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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
qubit[5] q;
ryy(1.3387927028900137) q[1], q[4];
s q[2];
cu1(4.327648992783747) q[3], q[0];
csx q[4], q[0];
sxdg q[2];
cp(5.063737553595113) q[3], q[1];
sdg q[4];
id q[2];
U(2.6931435867040623, 5.054176108785495, 3.759042291997415) q[1];
t q[3];
tdg q[0];
y q[2];
rz(5.456392906866783) q[1];
rx(4.109737799080254) q[3];
h q[4];
s q[0];
ecr q[4], q[1];
z q[0];
id q[2];
p(1.4760545987873055) q[2];
h q[4];
z q[1];
u3(0.20119726267154447, 3.4475609274702976, 5.641952437029047) q[3];
ry(4.100342231596967) q[0];
r(0.4705523904999244, 3.1637319331003466) q[3];
cs q[1], q[4];
r(3.2582985834136395, 5.419997989359705) q[2];
sxdg q[0];
rx(6.173987827143486) q[3];
id q[4];
y q[1];
u1(1.7648537320050977) q[2];
id q[3];
x q[1];
u3(1.3409907138771748, 3.8089237944154686, 5.952771865873595) q[2];
x q[4];
swap q[0], q[1];
h q[4];
crx(3.2389384618623627) q[3], q[2];
y q[4];
s q[1];
cz q[3], q[2];
z q[0];
h q[4];
t q[2];
sxdg q[1];
u2(2.0344751026573746, 2.5540818196400648) q[3];
y q[0];
tdg q[3];
ecr q[1], q[2];
csdg q[4], q[0];
cu(1.5710169675732266, 0.8934616087330054, 3.440188816489238, 2.2782542559755172) q[3], q[1];
cu1(4.46046058461597) q[4], q[2];
sdg q[4];
cz q[1], q[3];
crx(0.8097926660785695) q[0], q[2];
