OPENQASM 3.0;
include "stdgates.inc";
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[5] q;
sxdg q[0];
id q[1];
p(1.0366125729723656) q[3];
s q[4];
sx q[2];
tdg q[2];
s q[0];
s q[4];
cry(0.8893295245118703) q[3], q[1];
rz(2.7082134688209356) q[0];
p(3.1356292256072535) q[4];
cy q[3], q[2];
s q[1];
crx(2.980723246167555) q[4], q[3];
ry(6.1547885952022465) q[0];
u1(0.915651464088216) q[2];
u3(3.612308707034267, 2.528761789713649, 0.8008951275774369) q[1];
h q[3];
iswap q[1], q[4];
sxdg q[0];
u2(1.6316976193314152, 1.6499992371727425) q[2];
rz(4.649727533275964) q[1];
h q[0];
ry(1.708349873977016) q[2];
id q[3];
ry(4.151673731854044) q[3];
u2(3.607259037503121, 0.3368502040559055) q[4];
rz(4.505964750560519) q[0];
swap q[2], q[1];
rz(3.9631514787059956) q[1];
ryy(3.5476117264416493) q[3], q[0];
sdg q[4];
t q[2];
rxx(5.792878716342212) q[4], q[0];
t q[1];
crz(4.173285996273331) q[2], q[3];
r(3.768487817518589, 3.4576458390837788) q[0];
z q[3];
x q[2];
h q[4];
z q[1];
