using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Collections.Generic;

internal static class Launcher {
    static string Root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    static string Instance;
    [STAThread] static void Main(string[] args) {
        Application.EnableVisualStyles();
        using (var sha = SHA256.Create()) Instance = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Root.ToLowerInvariant()))).Replace("-", "").Substring(0, 20);
        bool created;
        using (var mutex = new Mutex(true, "Local\\TalentFit-" + Instance, out created)) {
            try {
                if (!created) {
                    for (int attempt = 0; attempt < 60; attempt++) {
                        for (int p = 17840; p < 17860; p++) if (Healthy(p)) {
                            if (Array.IndexOf(args, "--smoke-test") >= 0) File.WriteAllText(Path.Combine(Root, "logs", "reuse-result.txt"), "PASS reused port=" + p);
                            else Open(p);
                            return;
                        }
                        Thread.Sleep(500);
                    }
                    MessageBox.Show("TalentFit 正在启动，请稍后重试。", "TalentFit"); return;
                }
                Application.Run(new DesktopContext(args));
            } catch (Exception ex) { MessageBox.Show("启动失败：" + ex.Message + "\n请查看 logs 文件夹。", "TalentFit", MessageBoxButtons.OK, MessageBoxIcon.Error); }
            finally { if (created) mutex.ReleaseMutex(); }
        }
    }
    static bool Healthy(int port) {
        try {
            var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
            request.Timeout = 300; request.Proxy = null;
            using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) {
                var data = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                return data.ContainsKey("app") && (string)data["app"] == "TalentFit" && data.ContainsKey("instance") && (string)data["instance"] == Instance;
            }
        } catch { return false; }
    }
    static void Open(int port) {
        string url = "http://127.0.0.1:" + port;
        string[] browsers = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google\\Chrome\\Application\\chrome.exe")
        };
        foreach (string browser in browsers) if (File.Exists(browser)) {
            Process.Start(new ProcessStartInfo(browser, "--app=" + url + " --window-size=1400,950") { UseShellExecute = false }); return;
        }
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
    class DesktopContext : ApplicationContext {
        NotifyIcon tray;
        Process server;
        int port;
        bool smoke;
        System.Windows.Forms.Timer timer;
        public DesktopContext(string[] args) {
            smoke = Array.IndexOf(args, "--smoke-test") >= 0;
            string runtime = Path.Combine(Root, "python");
            string python = Path.Combine(runtime, "python.exe");
            if (!File.Exists(python)) throw new Exception("便携运行文件缺失，请重新解压完整的 TalentFit 文件夹。");
            Directory.CreateDirectory(Path.Combine(Root, "data")); Directory.CreateDirectory(Path.Combine(Root, "logs"));
            string db = Path.Combine(Root, "data", "talentfit.db");
            for (int p = 17840; p < 17860; p++) if (Healthy(p)) { port = p; break; }
            if (port == 0) {
                for (int p = 17840; p < 17860; p++) {
                    try { var listener = new TcpListener(IPAddress.Loopback, p); listener.Start(); listener.Stop(); port = p; break; } catch (SocketException) { }
                }
                if (port == 0) throw new Exception("本机端口 17840–17859 均被占用。");
                var info = new ProcessStartInfo(python, "-B \"" + Path.Combine(Root, "app", "server.py") + "\"") {
                    WorkingDirectory = Root, UseShellExecute = false, CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true
                };
                info.EnvironmentVariables["PORT"] = port.ToString();
                info.EnvironmentVariables["TF_DATA_PATH"] = db;
                info.EnvironmentVariables["TF_DIST_PATH"] = Path.Combine(Root, "dist");
                info.EnvironmentVariables["TF_INSTANCE"] = Instance;
                info.EnvironmentVariables["TF_API_KEY"] = "";
                server = new Process { StartInfo = info };
                server.OutputDataReceived += Log; server.ErrorDataReceived += Log;
                server.Start(); server.BeginOutputReadLine(); server.BeginErrorReadLine();
                var ready = new Form { Text = "TalentFit", Width = 370, Height = 130, StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog, ControlBox = false };
                ready.Controls.Add(new Label { Text = "正在启动本地工作台，请稍候…", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter });
                if (!smoke) ready.Show();
                bool healthy = false;
                for (int n = 0; n < 120; n++) {
                    Application.DoEvents();
                    if (server.HasExited) break;
                    if (Healthy(port)) { healthy = true; break; }
                    Thread.Sleep(250);
                }
                ready.Dispose();
                if (!healthy) { StopServer(); throw new Exception("本地服务未就绪，请检查 logs/server.log。"); }
            }
            if (smoke) {
                File.WriteAllText(Path.Combine(Root, "logs", "smoke-result.txt"), "PASS port=" + port);
                timer = new System.Windows.Forms.Timer { Interval = Array.IndexOf(args, "--hold") >= 0 ? 8000 : 500 };
                timer.Tick += delegate { timer.Stop(); ExitThread(); }; timer.Start(); return;
            }
            tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "TalentFit — 本地人岗匹配", Visible = true };
            var menu = new ContextMenuStrip();
            menu.Items.Add("打开 TalentFit", null, delegate { Open(port); });
            menu.Items.Add("退出 TalentFit", null, delegate {
                if (MessageBox.Show("退出将停止正在处理的简历任务，确定退出？", "TalentFit", MessageBoxButtons.OKCancel) == DialogResult.OK) ExitThread();
            });
            tray.ContextMenuStrip = menu; tray.DoubleClick += delegate { Open(port); };
            Open(port);
        }
        static readonly object LogLock = new object();
        void Log(object sender, DataReceivedEventArgs e) { if (e.Data != null) lock (LogLock) { try { File.AppendAllText(Path.Combine(Root, "logs", "server.log"), DateTime.Now.ToString("s") + " " + e.Data + Environment.NewLine); } catch { } } }
        void StopServer() { if (server != null) { try { if (!server.HasExited) { server.Kill(); server.WaitForExit(3000); } } catch { } server.Dispose(); server = null; } }
        protected override void ExitThreadCore() { StopServer(); if (tray != null) { tray.Visible = false; tray.Dispose(); } if (timer != null) timer.Dispose(); base.ExitThreadCore(); }
    }
}
