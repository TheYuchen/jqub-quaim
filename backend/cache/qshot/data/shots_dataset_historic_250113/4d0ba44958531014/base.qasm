OPENQASM 3.0;
include "stdgates.inc";
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
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
rzx(2.9600786334419418) q[6], q[5];
u1(6.191618395714986) q[0];
cry(5.331432289563093) q[7], q[4];
xx_plus_yy(1.1305163640340676, 1.2185678609930077) q[1], q[3];
swap q[4], q[7];
p(3.837952243098932) q[0];
csx q[2], q[3];
iswap q[5], q[1];
cu1(5.712853082574412) q[5], q[2];
cu(4.213273589115869, 2.4614110747888, 0.9723987275059797, 3.125455213310551) q[6], q[0];
h q[7];
swap q[4], q[3];
cz q[6], q[2];
u3(2.5310573359370308, 4.782409552247849, 1.9739651976541086) q[4];
dcx q[1], q[7];
U(1.6952420350850477, 1.9382455537837602, 3.66981738096991) q[5];
cry(4.562189333915683) q[0], q[3];
cx q[1], q[2];
ecr q[0], q[6];
ryy(3.6775164976610566) q[7], q[4];
cu3(6.282427234463047, 5.552958125708043, 5.958282774424159) q[3], q[5];
swap q[5], q[7];
ryy(3.586065392179367) q[0], q[4];
rxx(1.7841188351901762) q[2], q[6];
t q[1];
cx q[6], q[0];
u3(2.9531557601735274, 2.2491191359546323, 1.9691796705291202) q[3];
x q[5];
ch q[4], q[2];
iswap q[7], q[1];
rz(1.4181495432948585) q[0];
dcx q[3], q[5];
sx q[7];
cx q[1], q[4];
rxx(1.9403377977975005) q[6], q[2];
x q[3];
u3(5.313217117414695, 3.2645177314585734, 4.953940431864166) q[6];
cry(4.072737873033695) q[4], q[1];
cy q[0], q[7];
rx(1.9151959281757862) q[2];
cu1(1.5418994726745174) q[6], q[0];
ry(3.097295845851053) q[3];
crz(4.536878162843403) q[2], q[4];
crz(1.474197774716079) q[5], q[7];
