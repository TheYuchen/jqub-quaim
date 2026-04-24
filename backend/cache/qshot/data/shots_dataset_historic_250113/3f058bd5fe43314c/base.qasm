OPENQASM 3.0;
include "stdgates.inc";
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
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
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
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
qubit[8] q;
csdg q[5], q[7];
dcx q[6], q[3];
rzz(5.105204945084262) q[0], q[1];
id q[4];
id q[2];
t q[1];
cu1(5.938063722398524) q[2], q[6];
ch q[5], q[7];
ch q[4], q[3];
ry(0.2709140922982615) q[0];
cu(6.05663734096175, 1.7027288255222506, 0.4036056160923394, 4.430714892643363) q[2], q[0];
cy q[4], q[7];
cy q[3], q[6];
swap q[5], q[1];
cu(1.9757269169487501, 0.8899163521137058, 1.282433243485264, 4.174547115699516) q[0], q[1];
sdg q[3];
crx(1.177329856422366) q[5], q[2];
u3(0.3420056184001245, 3.6714699533808504, 4.439396409180844) q[7];
ch q[4], q[6];
xx_minus_yy(1.605743524358636, 2.530812841762223) q[0], q[7];
crx(2.251294850295142) q[1], q[6];
rzx(1.5319715439940595) q[3], q[4];
ryy(0.7756281053567887) q[5], q[2];
