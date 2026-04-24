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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[5] q;
rccx q[2], q[0], q[3];
ry(2.1605790111257424) q[4];
sxdg q[1];
u1(1.0277267491176725) q[0];
sxdg q[4];
sx q[3];
x q[1];
id q[4];
rz(1.727408073349643) q[1];
sdg q[3];
U(3.639696912236866, 3.450990142921617, 5.074943797143012) q[2];
u3(1.1549285876385227, 2.8531897434331994, 4.287801805984945) q[0];
p(1.2890545312747592) q[1];
u2(2.179160851331544, 5.239769516300427) q[0];
u3(5.928202206613386, 3.218606389610161, 2.393254815763574) q[3];
dcx q[4], q[2];
z q[0];
cswap q[4], q[1], q[2];
z q[3];
h q[2];
sx q[1];
ry(0.44974041246804264) q[0];
x q[4];
z q[3];
t q[3];
cswap q[4], q[2], q[0];
h q[1];
x q[1];
x q[4];
z q[2];
r(4.076701942643553, 3.486409144914327) q[0];
U(1.8690792301109767, 4.033772544386338, 4.385324275854851) q[3];
