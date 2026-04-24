OPENQASM 3.0;
include "stdgates.inc";
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
qubit[8] q;
sdg q[5];
ry(2.429113681507945) q[0];
rz(5.007023637248338) q[4];
sdg q[6];
rzz(3.6026643851155153) q[7], q[1];
rxx(0.9375667372429762) q[3], q[2];
iswap q[7], q[4];
h q[6];
z q[2];
sxdg q[0];
ry(1.9725071781179666) q[3];
sx q[1];
z q[2];
ryy(5.877885922228788) q[7], q[1];
tdg q[3];
cx q[0], q[5];
ryy(4.983085140216703) q[6], q[4];
ch q[2], q[5];
ryy(1.9797505993733817) q[3], q[6];
cp(2.3148837172328323) q[7], q[0];
h q[4];
t q[1];
crz(0.9390758752831599) q[4], q[7];
cry(5.812776343969309) q[0], q[2];
iswap q[5], q[6];
dcx q[1], q[3];
xx_plus_yy(2.74882220426368, 2.270273825661165) q[6], q[4];
dcx q[7], q[1];
r(4.104554158137153, 1.5840060037691206) q[2];
rx(0.5190840970239817) q[3];
ecr q[0], q[5];
tdg q[7];
cu1(3.3884187050459857) q[4], q[6];
s q[3];
cu(2.8815929359722054, 4.9712772765691895, 2.3253015758415008, 0.6075642935812928) q[0], q[2];
csx q[1], q[5];
crx(2.7459680471184558) q[1], q[6];
sx q[5];
s q[0];
tdg q[4];
x q[7];
y q[2];
