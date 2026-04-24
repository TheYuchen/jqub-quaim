OPENQASM 3.0;
include "stdgates.inc";
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
qubit[5] q;
rz(2.2812525435703233) q[4];
z q[0];
id q[3];
iswap q[2], q[1];
rzx(4.6802912063400495) q[3], q[1];
sx q[2];
ecr q[4], q[0];
rz(3.4557897692529416) q[2];
xx_minus_yy(3.502380733355598, 2.6817067023443153) q[4], q[0];
dcx q[3], q[1];
rx(3.2281636886907505) q[2];
rzx(2.5904039795988454) q[4], q[3];
u2(1.0318709845128684, 2.1757294438289714) q[1];
y q[0];
tdg q[3];
u1(1.9593460610003668) q[0];
cp(2.6222976502989033) q[4], q[2];
t q[1];
sdg q[3];
rzz(1.1280411888211939) q[2], q[0];
t q[4];
ch q[3], q[2];
s q[0];
sxdg q[4];
p(3.8790657549370873) q[1];
u1(5.094038980995575) q[0];
ry(0.44775268992754685) q[3];
u2(2.2608711908522845, 4.564645618957203) q[2];
ry(5.856564065128201) q[4];
