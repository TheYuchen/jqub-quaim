OPENQASM 3.0;
include "stdgates.inc";
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
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
ccz q[2], q[1], q[5];
cswap q[4], q[0], q[3];
dcx q[0], q[4];
rccx q[2], q[1], q[5];
tdg q[3];
ccz q[5], q[4], q[3];
rccx q[1], q[0], q[2];
id q[5];
ccz q[3], q[4], q[1];
cry(5.098796069420782) q[0], q[2];
ry(6.195242942140236) q[3];
p(5.762146757481668) q[0];
cswap q[2], q[5], q[4];
u2(6.2337593126083455, 3.803865914557964) q[1];
sxdg q[4];
h q[3];
ccz q[5], q[1], q[2];
y q[0];
ccz q[2], q[4], q[0];
rx(6.102061741283596) q[1];
cry(2.1785016989337014) q[5], q[3];
cswap q[3], q[1], q[0];
cp(6.189212277813866) q[2], q[5];
ccx q[2], q[5], q[1];
rzx(0.8505623571417174) q[3], q[4];
tdg q[0];
U(2.5174116805907194, 2.7122723954510795, 2.7825030190071787) q[3];
id q[5];
x q[4];
ccz q[1], q[0], q[2];
rccx q[3], q[2], q[5];
cy q[1], q[0];
cu3(4.72593939919585, 2.108233302666919, 4.210557736819076) q[0], q[1];
rz(2.7335061387178885) q[4];
rccx q[3], q[2], q[5];
ccx q[3], q[0], q[4];
ccx q[1], q[5], q[2];
swap q[0], q[4];
ccx q[3], q[1], q[2];
u1(4.906414665547148) q[2];
sxdg q[3];
id q[4];
ccz q[1], q[0], q[5];
