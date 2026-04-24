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
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
qubit[5] q;
rz(3.990428840646003) q[4];
rccx q[1], q[3], q[0];
z q[0];
ccz q[3], q[4], q[1];
sxdg q[2];
rccx q[4], q[0], q[1];
h q[3];
tdg q[0];
xx_plus_yy(0.7877498081604896, 0.20116717563617884) q[4], q[2];
rzx(5.363046526501411) q[1], q[3];
cy q[4], q[0];
u2(0.2733754623578538, 4.1217662345321635) q[2];
u3(2.844448424597986, 2.42529280408297, 0.7632881475467442) q[3];
ccx q[1], q[0], q[3];
cz q[4], q[2];
cy q[0], q[1];
ccz q[3], q[4], q[2];
crx(5.83010949304148) q[2], q[1];
rxx(5.617686882021139) q[0], q[3];
h q[4];
xx_minus_yy(1.4434057238486324, 3.98621697026415) q[1], q[4];
cry(1.3458675351925666) q[0], q[3];
rx(4.208767403659014) q[2];
xx_plus_yy(4.392656027834105, 0.10474761844432866) q[0], q[1];
U(1.2054590122435076, 3.2233070698846524, 3.000373092564391) q[2];
rz(5.533504694192619) q[3];
x q[4];
rccx q[2], q[0], q[3];
y q[1];
u3(1.4258666290239561, 0.8998523995395002, 5.454352698119848) q[4];
csdg q[0], q[2];
ccz q[3], q[1], q[4];
rccx q[1], q[2], q[4];
p(4.878993737766654) q[1];
rx(0.5313684965615142) q[2];
rccx q[3], q[0], q[4];
rccx q[3], q[1], q[2];
p(5.327220216976956) q[4];
u2(5.605628626262917, 4.539912136884003) q[0];
