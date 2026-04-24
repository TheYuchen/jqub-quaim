OPENQASM 3.0;
include "stdgates.inc";
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
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
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
qubit[8] q;
csx q[1], q[5];
dcx q[6], q[7];
rxx(0.5152789424027312) q[3], q[0];
cry(2.1094396467364755) q[2], q[4];
swap q[2], q[6];
rzz(5.734406793378138) q[3], q[1];
csdg q[7], q[4];
iswap q[5], q[0];
dcx q[4], q[5];
cu3(4.26402602878856, 0.20611820624159233, 5.1555205643072535) q[3], q[7];
rzz(3.5684585141859095) q[0], q[6];
xx_plus_yy(0.7261732578641863, 5.062296369497323) q[2], q[1];
cy q[5], q[0];
xx_plus_yy(3.5959098270227376, 0.4509824984125806) q[7], q[2];
xx_plus_yy(0.17583087978319992, 6.189103956952891) q[3], q[6];
cu3(2.8041851480775346, 3.2678404773577987, 3.3287333697367343) q[1], q[4];
cz q[7], q[4];
xx_minus_yy(4.290605621493977, 1.5906224563509006) q[2], q[3];
xx_plus_yy(4.423633457546721, 4.881254695905658) q[1], q[5];
cx q[0], q[6];
ch q[2], q[5];
csx q[1], q[4];
cu1(1.8553437952834662) q[3], q[6];
swap q[0], q[7];
rxx(1.7854847500045592) q[5], q[2];
cu1(2.5844270078408194) q[0], q[4];
rzz(3.964886083790133) q[7], q[3];
dcx q[1], q[6];
cu(3.7051710349484464, 2.0403916001684816, 2.3788700765104234, 5.8779876397086905) q[3], q[5];
cp(6.024396183139204) q[4], q[1];
csdg q[6], q[2];
cp(0.5198483017214782) q[0], q[7];
rzz(4.386406697407171) q[1], q[6];
z q[5];
cy q[3], q[0];
csx q[2], q[4];
cu(4.882844576947691, 3.1281469741867305, 3.4372601537117444, 3.9203618452882183) q[1], q[3];
cu3(6.1191945451047625, 0.5115311589377277, 2.731918060138741) q[0], q[7];
rzz(2.5188339212559927) q[4], q[6];
xx_minus_yy(0.6325714462478618, 2.0897582979900093) q[2], q[5];
