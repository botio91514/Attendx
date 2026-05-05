import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Clock, Coffee, ShieldAlert, Save, Loader2, Info, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    officeStartTime: '09:15',
    officeEndTime: '18:15',
    lateGraceMinutes: 15,
    halfDayThreshold: 4,
    minWorkMinutes: 30,
    autoCheckoutTime: '19:00',
    maxDailyCredit: 1.0,
    weekendPolicy: 'holiday',
    autoBreakMinutes: 0,
    breakPolicy: 'manual',
    breakDurationMinutes: 60,
    workingDays: [1, 2, 3, 4, 5, 6] // default Mon-Sat
  });

  const [recalcMode, setRecalcMode] = useState<'future_only' | 'range'>('future_only');
  const [recalcRange, setRecalcRange] = useState({ start: '', end: '' });
  const [isRecalculating, setIsRecalculating] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.success && res.data) {
        setSettings({
          officeStartTime: res.data.officeStartTime,
          officeEndTime: res.data.officeEndTime,
          lateGraceMinutes: res.data.lateGraceMinutes || res.data.lateGracePeriod || 0,
          halfDayThreshold: res.data.halfDayThreshold,
          minWorkMinutes: res.data.minWorkMinutes || 30,
          autoCheckoutTime: res.data.autoCheckoutTime || '19:00',
          maxDailyCredit: res.data.maxDailyCredit || 1.0,
          weekendPolicy: res.data.weekendPolicy || 'holiday',
          autoBreakMinutes: res.data.autoBreakMinutes || 0,
          breakPolicy: res.data.breakPolicy || 'manual',
          breakDurationMinutes: res.data.breakDurationMinutes || 60,
          workingDays: res.data.workingDays || [1, 2, 3, 4, 5, 6]
        });
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/settings', settings);
      if (res.success) {
        toast.success('Settings updated successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (recalcMode === 'range' && (!recalcRange.start || !recalcRange.end)) {
      return toast.error('Please select date range');
    }

    try {
      setIsRecalculating(true);
      const res = await api.post('/admin/attendance/recalculate', {
        mode: recalcMode,
        startDate: recalcRange.start,
        endDate: recalcRange.end
      });
      if (res.success) {
        toast.success(res.message);
      }
    } catch (error: any) {
      toast.error(error.message || 'Recalculation failed');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }} className="max-w-4xl space-y-8">
      <motion.div variants={fadeUp}>
        <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" /> Office Settings
        </h2>
        <p className="text-muted-foreground mt-2">Configure global office timings and attendance policies</p>
      </motion.div>

      <motion.form variants={fadeUp} onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Work Hours */}
              <div className="glass-card p-6 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Clock className="w-5 h-5 text-primary" /> Shift Timings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Shift Start Time</label>
                    <input 
                      type="time" 
                      value={settings.officeStartTime} 
                      onChange={e => setSettings({...settings, officeStartTime: e.target.value})}
                      className="input-floating"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Shift End Time</label>
                    <input 
                      type="time" 
                      value={settings.officeEndTime} 
                      onChange={e => setSettings({...settings, officeEndTime: e.target.value})}
                      className="input-floating"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic pt-2 border-t border-glass-border">Used to evaluate Late and Overtime status.</p>
                </div>
              </div>

              {/* Guidelines */}
              <div className="glass-card p-6 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <ShieldAlert className="w-5 h-5 text-warning" /> Attendance Rules
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Late Grace Period (Min)</label>
                    <input 
                      type="number" 
                      value={settings.lateGraceMinutes} 
                      onChange={e => setSettings({...settings, lateGraceMinutes: parseInt(e.target.value) || 0})}
                      className="input-floating"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Half-Day Threshold (Hrs)</label>
                    <input 
                      type="number" 
                      value={settings.halfDayThreshold} 
                      onChange={e => setSettings({...settings, halfDayThreshold: parseInt(e.target.value) || 0})}
                      className="input-floating"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Min Work (Min)</label>
                    <input 
                      type="number" 
                      value={settings.minWorkMinutes} 
                      onChange={e => setSettings({...settings, minWorkMinutes: parseInt(e.target.value) || 0})}
                      className="input-floating"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Auto Checkout Time</label>
                    <input 
                      type="time" 
                      value={settings.autoCheckoutTime} 
                      onChange={e => setSettings({...settings, autoCheckoutTime: e.target.value})}
                      className="input-floating"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Max Daily Credit</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.5"
                      max="2.0"
                      value={settings.maxDailyCredit} 
                      onChange={e => setSettings({...settings, maxDailyCredit: parseFloat(e.target.value) || 1.0})}
                      className="input-floating"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic pt-2 border-t border-glass-border">Advanced rules for automated attendance evaluation.</p>
                </div>
              </div>

              {/* Break Policy */}
              <div className="glass-card p-6 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Coffee className="w-5 h-5 text-success" /> Break Policy
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Break Mode</label>
                    <select 
                      value={settings.breakPolicy}
                      onChange={e => setSettings({...settings, breakPolicy: e.target.value as any})}
                      className="input-floating py-2"
                    >
                      <option value="manual">Manual (Employee Log)</option>
                      <option value="auto-after-threshold">Auto-Deduct After 4h</option>
                    </select>
                  </div>
                  {settings.breakPolicy === 'auto-after-threshold' && (
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Auto Break Minutes</label>
                      <input 
                        type="number" 
                        value={settings.autoBreakMinutes} 
                        onChange={e => setSettings({...settings, autoBreakMinutes: parseInt(e.target.value) || 0})}
                        className="input-floating"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Total Allowance (Min)</label>
                    <div className="flex gap-2 mb-3">
                      {[30, 45, 60, 90].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSettings({...settings, breakDurationMinutes: val})}
                          className={`flex-1 py-1 rounded-md text-[10px] font-bold border transition-all ${
                            settings.breakDurationMinutes === val 
                            ? 'bg-success/20 border-success/30 text-success' 
                            : 'bg-secondary/50 border-glass-border text-muted-foreground'
                          }`}
                        >
                          {val}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekend Policy */}
              <div className="glass-card p-6 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Calendar className="w-5 h-5 text-primary" /> Weekend & Days
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                        const isActive = settings.workingDays.includes(idx);
                        return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                  const newDays = isActive 
                                    ? settings.workingDays.filter(d => d !== idx)
                                    : [...settings.workingDays, idx].sort((a,b) => a-b);
                                  setSettings({...settings, workingDays: newDays});
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold font-display transition-all border ${
                                  isActive 
                                    ? 'bg-primary/10 text-primary border-primary/20' 
                                    : 'bg-secondary/5 text-muted-foreground border-glass-border opacity-60'
                              }`}
                            >
                              {day}
                            </button>
                        );
                      })}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Weekend Policy</label>
                    <select 
                      value={settings.weekendPolicy}
                      onChange={e => setSettings({...settings, weekendPolicy: e.target.value as any})}
                      className="input-floating py-2"
                    >
                      <option value="holiday">Mark as Holiday (Paid/Free)</option>
                      <option value="working">Process as Normal Day</option>
                      <option value="optional">Optional (No Payroll Impact)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Statistics ignore unmarked days.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <div className="glass-card p-6 bg-primary/5 border-primary/10">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-primary" /> Office Operation Stats</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-center py-2 border-b border-glass-border">
                      <span className="text-xs text-muted-foreground">Work Week</span>
                      <span className="text-xs font-bold text-foreground">{settings.workingDays.length} Days / Week</span>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-glass-border">
                      <span className="text-xs text-muted-foreground">Standard Shift</span>
                      <span className="text-xs font-bold text-foreground">
                         {(() => {
                            const [sH, sM] = settings.officeStartTime.split(':').map(Number);
                            const [eH, eM] = settings.officeEndTime.split(':').map(Number);
                            const diff = (eH * 60 + eM) - (sH * 60 + sM);
                            return (diff / 60).toFixed(1);
                         })()} Hours
                      </span>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-glass-border">
                      <span className="text-xs text-muted-foreground">Lunch Break Duration</span>
                      <span className="text-xs font-bold text-success">{settings.breakDurationMinutes} Minutes</span>
                   </div>
                </div>
             </div>

             <div className="p-4 rounded-xl border border-glass-border bg-card/50">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3 px-1 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-warning" /> Maintenance
                </h4>
                <div className="space-y-3">
                   <div className="flex flex-col gap-2">
                      <select 
                        value={recalcMode}
                        onChange={e => setRecalcMode(e.target.value as any)}
                        className="bg-background/50 border border-glass-border rounded-lg p-2 text-xs"
                      >
                         <option value="future_only">From Today Onwards</option>
                         <option value="range">Specific Date Range</option>
                      </select>
                      {recalcMode === 'range' && (
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            className="flex-1 bg-background/50 border border-glass-border rounded-lg p-1 text-[10px]"
                            value={recalcRange.start}
                            onChange={e => setRecalcRange({...recalcRange, start: e.target.value})}
                          />
                          <input 
                            type="date" 
                            className="flex-1 bg-background/50 border border-glass-border rounded-lg p-1 text-[10px]"
                            value={recalcRange.end}
                            onChange={e => setRecalcRange({...recalcRange, end: e.target.value})}
                          />
                        </div>
                      )}
                      <button 
                        type="button"
                        disabled={isRecalculating}
                        onClick={handleRecalculate}
                        className="w-full py-2 bg-warning/10 hover:bg-warning/20 border border-warning/30 text-warning text-[10px] font-bold rounded-lg transition-all"
                      >
                        {isRecalculating ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "RECALCULATE ATTENDANCE"}
                      </button>
                   </div>
                   <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                      Force re-evaluation of all attendance records based on current policy settings.
                   </p>
                </div>
             </div>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            These settings will be applied immediately to all new check-ins and break actions. 
            Existing records for today will be updated when users next perform an action (Check-out or Break end).
          </p>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={saving} className="glow-button-primary flex items-center gap-2 px-8 py-3">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Dynamic Settings
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

export default Settings;
