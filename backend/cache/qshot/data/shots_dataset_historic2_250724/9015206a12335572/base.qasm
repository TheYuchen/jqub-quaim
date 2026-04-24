OPENQASM 3.0;
include "stdgates.inc";
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
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
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
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
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
tdg q[1];
rxx(2.9189945104555575) q[0], q[5];
tdg q[3];
ryy(5.846651546279909) q[6], q[2];
sdg q[4];
u3(1.343288835323411, 2.295670797944428, 3.305288381389598) q[1];
cu3(2.217042952189295, 2.770876128693017, 0.8426250111000646) q[4], q[3];
r(0.060640270115849965, 0.27741265006891247) q[5];
sxdg q[6];
u3(0.9916937569711883, 2.6141012844511162, 5.5565612969277645) q[2];
cx q[1], q[0];
cx q[2], q[5];
U(6.056526270357789, 2.6210109051591313, 3.5981931573756714) q[3];
cp(2.4978444968622755) q[4], q[6];
csx q[0], q[1];
p(1.6051588529475695) q[5];
dcx q[6], q[3];
rx(5.433124885543005) q[4];
u1(1.6972382680953826) q[3];
cs q[0], q[2];
csdg q[5], q[4];
u2(1.729008304681246, 1.7174249957922412) q[6];
u3(4.170366185603382, 1.1550350022739648, 1.7988053960648525) q[1];
rxx(0.292016475919222) q[4], q[6];
dcx q[3], q[1];
rx(4.801100673292872) q[0];
id q[2];
cu(1.2940007909477165, 1.5647416494397683, 4.603086028397491, 0.7331405842410875) q[0], q[6];
cry(3.0878530379004707) q[2], q[1];
id q[5];
cu(1.1890824045609703, 4.865568712471977, 1.6317691117756628, 4.3021115686872475) q[4], q[3];
cu1(1.765344251546941) q[5], q[2];
y q[3];
r(1.063411767791223, 4.908720619217132) q[6];
ecr q[1], q[0];
sdg q[4];
sx q[0];
id q[5];
p(4.863552412795286) q[3];
p(4.170382724539343) q[4];
cy q[2], q[1];
p(4.079834546612208) q[6];
u3(2.511978750909597, 1.908888448207862, 3.2387954212618086) q[5];
rzx(1.8949472920502664) q[4], q[6];
u2(5.035542247214407, 5.271711614238516) q[2];
cu1(1.2441443867448847) q[0], q[3];
