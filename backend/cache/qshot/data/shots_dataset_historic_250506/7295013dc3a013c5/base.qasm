OPENQASM 3.0;
include "stdgates.inc";
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
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
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
qubit[8] q;
cswap q[3], q[7], q[0];
rccx q[5], q[1], q[6];
ryy(6.085328222057665) q[2], q[4];
ccx q[2], q[6], q[5];
rccx q[0], q[1], q[3];
xx_plus_yy(5.8289817258245895, 5.251622972358945) q[4], q[7];
ccz q[2], q[6], q[3];
rccx q[7], q[4], q[0];
rxx(4.052580925518872) q[1], q[5];
rccx q[2], q[1], q[3];
ccz q[7], q[6], q[0];
cu3(4.704012819984333, 3.4222325370377034, 6.1123065006237844) q[5], q[4];
rxx(5.0074417605116155) q[4], q[1];
ccz q[6], q[3], q[7];
cu3(2.045256841347026, 4.618557898358463, 3.0993059548817246) q[5], q[2];
z q[0];
cp(0.8014676210941197) q[4], q[7];
ccx q[1], q[2], q[5];
ccz q[6], q[0], q[3];
cx q[0], q[1];
ccx q[7], q[5], q[6];
ccx q[2], q[4], q[3];
ccx q[1], q[5], q[4];
cswap q[2], q[3], q[6];
rx(4.602192652614892) q[0];
