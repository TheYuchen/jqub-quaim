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
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
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
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
qubit[8] q;
csx q[3], q[2];
dcx q[6], q[4];
cz q[0], q[5];
dcx q[1], q[7];
r(5.371928075486446, 5.097647660271362) q[6];
cry(4.301459601132315) q[3], q[0];
ecr q[5], q[4];
csdg q[1], q[2];
U(0.5889916108939462, 5.381083311689179, 3.50661746967381) q[7];
rzz(1.3478591695499709) q[5], q[2];
cy q[6], q[7];
U(1.3404005654288698, 5.947454248090762, 5.096321257548705) q[4];
cp(0.7567928016256414) q[1], q[0];
cu3(5.101823673915688, 5.12246908079663, 3.5817255059258524) q[2], q[1];
cy q[0], q[6];
cy q[5], q[7];
cu3(2.192515568697803, 5.267689693723789, 0.7985848066941567) q[4], q[3];
cu3(3.4845509660713776, 2.689668111350323, 3.7728711012937324) q[5], q[7];
dcx q[4], q[0];
crz(4.222067908775997) q[1], q[6];
dcx q[2], q[3];
rzz(0.3239436164976673) q[2], q[1];
rzz(1.8076174235082691) q[0], q[3];
csdg q[5], q[7];
cu(1.845771868244898, 1.2965204455585555, 0.9807441431716021, 2.678646933161867) q[4], q[6];
csdg q[4], q[0];
crx(5.097748091694481) q[2], q[6];
rzx(5.575941466112415) q[1], q[5];
cu3(3.6715799639902533, 5.922514617023665, 0.7795919183507544) q[7], q[3];
u3(0.19709079278676336, 2.303142082702134, 4.36854416726102) q[4];
ryy(2.9472721944034825) q[1], q[7];
iswap q[3], q[2];
swap q[0], q[5];
h q[6];
rzx(3.9258409559532144) q[7], q[5];
xx_plus_yy(5.620344162765735, 5.146862821922116) q[3], q[1];
xx_minus_yy(5.682375553869763, 1.7797319617141103) q[0], q[4];
x q[2];
t q[6];
cu(1.6440089544462018, 4.228819709231148, 1.9918711485023317, 3.8840114941767907) q[2], q[3];
ryy(1.9163727028085142) q[5], q[7];
ecr q[4], q[6];
cp(5.983006633875936) q[0], q[1];
csx q[6], q[1];
crz(0.6626622520076544) q[2], q[0];
cu(3.6479969757669806, 3.0558189470649157, 6.215386670875753, 2.567249186157238) q[3], q[5];
ch q[4], q[7];
csx q[1], q[2];
cy q[7], q[0];
swap q[4], q[5];
cry(4.411823594535705) q[3], q[6];
dcx q[0], q[6];
cs q[2], q[3];
iswap q[4], q[7];
ecr q[5], q[1];
csdg q[3], q[4];
crx(3.439801345294194) q[1], q[7];
cp(5.720577752429009) q[0], q[2];
rxx(1.1230744185926222) q[5], q[6];
rxx(1.1387104183919197) q[7], q[4];
cx q[1], q[0];
rxx(2.4171659276616233) q[3], q[6];
dcx q[2], q[5];
