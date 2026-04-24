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
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
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
qubit[5] q;
rccx q[4], q[0], q[1];
t q[3];
h q[2];
rzz(3.0595777375727846) q[0], q[3];
u2(2.9979317796971356, 0.006770148140024317) q[4];
t q[2];
U(0.4209830216121976, 3.0869838068592506, 5.315395452767156) q[3];
ccz q[4], q[0], q[1];
ry(0.33249250037885053) q[2];
t q[1];
y q[4];
rz(5.470527557871136) q[2];
z q[3];
rx(1.3819665088037911) q[1];
iswap q[3], q[2];
sx q[0];
ccz q[0], q[3], q[2];
rzx(4.6482368357388) q[1], q[4];
s q[4];
rccx q[2], q[0], q[1];
id q[1];
rzz(2.2023701478386526) q[2], q[4];
sdg q[3];
u1(1.7645624171045649) q[4];
u3(5.477918056055406, 0.22923385071387248, 4.20082416850931) q[2];
xx_plus_yy(1.1274710206906655, 1.1815891539190937) q[3], q[0];
U(4.782954432435194, 0.42943611976503304, 4.160237481309108) q[1];
rccx q[3], q[0], q[1];
xx_minus_yy(4.702105829620526, 1.3191004211085806) q[2], q[4];
