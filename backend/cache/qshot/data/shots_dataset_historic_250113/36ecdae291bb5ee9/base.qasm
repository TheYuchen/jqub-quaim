OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
cs q[6], q[4];
cp(5.45406182963917) q[1], q[3];
cz q[0], q[5];
sdg q[2];
cu3(4.256614262833797, 0.6171129923624482, 2.046265355704202) q[1], q[5];
id q[0];
xx_plus_yy(3.8548769115602672, 3.722002404480136) q[3], q[6];
cx q[4], q[2];
crx(0.19767249889967323) q[1], q[0];
rx(2.353924536630039) q[6];
rz(0.7800460524573765) q[2];
ecr q[3], q[5];
u2(4.677555911842458, 4.832612873820088) q[1];
U(1.8441785160954665, 3.1453460610064683, 5.269856440066596) q[2];
cp(6.0631864806016615) q[4], q[0];
cx q[5], q[6];
cu1(3.670184351134632) q[4], q[2];
crz(5.391475017306206) q[5], q[1];
ch q[6], q[0];
cs q[0], q[6];
rxx(0.461454573273247) q[1], q[4];
cry(3.2621582014802013) q[2], q[3];
t q[5];
id q[5];
swap q[2], q[3];
crz(0.5296006520975893) q[4], q[6];
cx q[1], q[0];
xx_minus_yy(4.167795045184037, 4.826681135975275) q[1], q[0];
xx_plus_yy(0.07498467618941394, 4.971618505919863) q[5], q[4];
cx q[6], q[2];
id q[3];
x q[0];
dcx q[3], q[6];
cp(2.1322453096825495) q[1], q[2];
rzx(1.506211373865476) q[4], q[5];
dcx q[6], q[4];
ch q[0], q[2];
dcx q[5], q[1];
s q[3];
ryy(2.318806718688749) q[6], q[0];
x q[4];
xx_plus_yy(1.0882746158198793, 5.2750032210098) q[2], q[1];
cy q[3], q[5];
swap q[2], q[4];
csx q[1], q[6];
xx_minus_yy(5.37442677275694, 2.0849977752917197) q[3], q[0];
cp(0.08415670599840981) q[4], q[5];
rx(6.195922893084394) q[3];
csx q[0], q[1];
cy q[6], q[2];
crz(1.9498218143143073) q[0], q[6];
cu1(5.889363365008921) q[3], q[5];
cu1(4.996652978140146) q[2], q[1];
rxx(2.9962902788291137) q[0], q[4];
ecr q[6], q[1];
cy q[2], q[5];
u3(4.535688153518519, 2.1552350242433684, 0.2847609245017813) q[3];
