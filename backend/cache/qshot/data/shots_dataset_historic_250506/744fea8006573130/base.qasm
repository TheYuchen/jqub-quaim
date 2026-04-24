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
qubit[7] q;
y q[1];
h q[4];
r(2.012935767340207, 0.6691980763274238) q[3];
ry(4.147092575890019) q[2];
u1(5.6173382362380035) q[5];
u1(5.246370652731751) q[0];
r(1.0280712295595116, 1.8880570724770682) q[6];
y q[1];
xx_minus_yy(5.519668344986475, 5.259128106566035) q[3], q[6];
y q[4];
sxdg q[5];
sx q[2];
t q[0];
sxdg q[0];
xx_minus_yy(5.811375506632617, 4.89232209175569) q[6], q[3];
u1(3.184636643158753) q[4];
t q[1];
u3(5.265678606122069, 3.177102498742302, 3.734927377398654) q[5];
u3(3.612479113821841, 3.9634736355839952, 1.7437217078519818) q[2];
