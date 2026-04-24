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
qubit[6] q;
u2(3.8389987291953633, 2.432476446421884) q[1];
sx q[4];
sx q[0];
ryy(1.0772772558763808) q[2], q[5];
cp(4.9645459922102) q[2], q[4];
sx q[1];
tdg q[5];
rz(1.7899201727923464) q[3];
tdg q[0];
rzx(5.064521483231251) q[3], q[5];
sdg q[0];
swap q[1], q[4];
u1(0.019283671377501258) q[2];
cy q[3], q[1];
sx q[2];
rxx(4.1092362934524935) q[4], q[5];
s q[0];
cu3(2.0666169230600886, 3.0183999183151484, 3.351155880648893) q[1], q[2];
y q[4];
U(4.468979229677715, 2.668599967835746, 2.5669336008545005) q[5];
cu(1.617493169997178, 2.4157222569310064, 3.525064398581159, 4.814180278374347) q[0], q[3];
