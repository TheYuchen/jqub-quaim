OPENQASM 3.0;
include "stdgates.inc";
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
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
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
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
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
qubit[7] q;
s q[0];
s q[5];
p(0.8233474247063649) q[4];
xx_minus_yy(1.3479421879155449, 5.819696674936983) q[6], q[1];
cs q[2], q[3];
xx_plus_yy(2.018110697864487, 5.264028889844457) q[0], q[2];
cu(2.2952192621064236, 3.391399890403255, 0.04968460711037114, 0.006413572187604329) q[4], q[5];
r(6.280104579516261, 0.8492904309139342) q[1];
dcx q[6], q[3];
h q[2];
u2(3.495646698502429, 1.9204587561309712) q[4];
z q[0];
rzz(4.205933539940737) q[3], q[5];
iswap q[1], q[6];
csx q[4], q[6];
xx_minus_yy(2.0076588171872967, 6.014992353400242) q[1], q[5];
iswap q[0], q[2];
h q[3];
rxx(5.344949476452607) q[2], q[1];
ecr q[0], q[3];
y q[5];
U(1.5323865919377708, 4.887355598824549, 4.754364520128812) q[4];
ry(4.983702001299339) q[6];
sx q[6];
sx q[0];
z q[2];
U(4.543783436554091, 3.8643264742550607, 2.72724268209839) q[1];
cu3(5.023423358377491, 3.89583315515988, 2.190512619163838) q[4], q[3];
u3(4.937025700843872, 5.4354084120365025, 4.797768131808938) q[5];
U(3.164017815099698, 4.386987446607321, 0.8648282490406495) q[4];
rx(3.0559718882303764) q[5];
z q[2];
ecr q[0], q[6];
ch q[3], q[1];
xx_minus_yy(3.1968802034841297, 1.5123454999807369) q[4], q[0];
xx_plus_yy(1.1245374976681561, 6.194752367426251) q[1], q[5];
ecr q[2], q[6];
u3(0.41846705682692403, 4.087700175988366, 4.540197248219504) q[3];
U(2.2270984656725457, 3.1406288057111724, 2.7807788506919997) q[0];
crx(3.8312441330953164) q[4], q[1];
ecr q[6], q[5];
u2(1.4221714647913246, 1.5140438092824333) q[2];
xx_minus_yy(5.654045753342713, 1.4011139252036966) q[2], q[1];
r(0.9636817370348517, 0.7090573426537573) q[6];
cu3(0.12219987138292297, 0.5885060023705672, 0.27876938159931147) q[3], q[0];
sdg q[5];
u1(6.213551005868135) q[4];
ryy(2.7161820173264326) q[4], q[1];
s q[0];
crz(4.414984698115272) q[6], q[2];
cu3(3.735546731248478, 3.243966911769286, 5.543626219333647) q[5], q[3];
u1(5.795255543569901) q[4];
ch q[0], q[5];
p(2.8349245460714037) q[1];
cz q[3], q[2];
cry(6.2754565314703195) q[6], q[2];
cx q[0], q[1];
h q[3];
id q[5];
x q[4];
rzz(5.498823379924879) q[5], q[0];
crx(5.250874542010935) q[6], q[1];
cp(3.702597103294045) q[4], q[3];
xx_minus_yy(4.4927033113665855, 2.7111418736947126) q[1], q[2];
cy q[4], q[3];
dcx q[5], q[0];
