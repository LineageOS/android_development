/* //device/apps/Settings/src/com/android/settings/Keyguard.java
**
** Copyright 2006, The Android Open Source Project
**
** Licensed under the Apache License, Version 2.0 (the "License"); 
** you may not use this file except in compliance with the License. 
** You may obtain a copy of the License at 
**
**     http://www.apache.org/licenses/LICENSE-2.0 
**
** Unless required by applicable law or agreed to in writing, software 
** distributed under the License is distributed on an "AS IS" BASIS, 
** WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
** See the License for the specific language governing permissions and 
** limitations under the License.
*/

package com.android.spare_parts;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.preference.CheckBoxPreference;
import android.preference.ListPreference;
import android.preference.Preference;
import android.preference.PreferenceActivity;
import android.preference.PreferenceGroup;
import android.preference.PreferenceScreen;
import android.provider.Settings;
import android.provider.Settings.SettingNotFoundException;
import android.view.IWindowManager;

import java.io.File;
import java.util.List;

public class SpareParts extends PreferenceActivity
        implements Preference.OnPreferenceChangeListener,
        SharedPreferences.OnSharedPreferenceChangeListener {
    private static final String TAG = "SpareParts";

    private static final String BATTERY_HISTORY_PREF = "battery_history_settings";
    private static final String BATTERY_INFORMATION_PREF = "battery_information_settings";
    private static final String USAGE_STATISTICS_PREF = "usage_statistics_settings";
    
    private static final String WINDOW_ANIMATIONS_PREF = "window_animations";
    private static final String TRANSITION_ANIMATIONS_PREF = "transition_animations";
    private static final String FANCY_IME_ANIMATIONS_PREF = "fancy_ime_animations";
    private static final String HAPTIC_FEEDBACK_PREF = "haptic_feedback";
    private static final String END_BUTTON_PREF = "end_button";
    private static final String KEY_COMPATIBILITY_MODE = "compatibility_mode";
    private static final String PIN_HOME_PREF = "pin_home";
    private static final String LAUNCHER_ORIENTATION_PREF = "launcher_orientation";
    private static final String LAUNCHER_COLUMN_PREF = "launcher_columns";
    private static final String BATTERY_STATUS_PREF = "battery_status";
    private static final String COMPCACHE_PREF = "compcache_enabled";
    
    //Wysie_Soh
    private static final String RECENT_APPS_NUM_PREF = "recent_apps_num";
    private static final String UI_SHOW_STATUS_CLOCK = "show_status_clock";
    private static final String UI_CLOCK_COLOR = "clock_color";
    private static final String UI_DATE_COLOR = "date_color";
    private static final String UI_NO_NOTIF_COLOR = "no_notifications_color";
    private static final String UI_LATEST_NOTIF_COLOR = "latest_notifications_color";
    private static final String UI_ONGOING_NOTIF_COLOR = "ongoing_notifications_color";
    private static final String UI_SPN_LABEL_COLOR = "spn_label_color";
    private static final String UI_PLMN_LABEL_COLOR = "plmn_label_color";
    private static final String UI_CLEAR_LABEL_COLOR = "clear_button_label_color";
    private static final String UI_BATTERY_PERCENT_COLOR = "battery_status_color_title";
    private static final String UI_NOTIF_TICKER_COLOR = "new_notifications_ticker_color";
    private static final String UI_NOTIF_ITEM_TITLE_COLOR = "notifications_title_color";
    private static final String UI_NOTIF_ITEM_TEXT_COLOR = "notifications_text_color";
    private static final String UI_NOTIF_ITEM_TIME_COLOR = "notifications_time_color";
    
    private final Configuration mCurConfig = new Configuration();
    
    //Wysie_Soh
    private ListPreference mRecentAppsNumPref;
    
    private Preference mBatteryPercentColorPreference;
    private Preference mClockColorPref;
    private Preference mDateColorPref;
    private Preference mSpnLabelColorPref;
    private Preference mPlmnLabelColorPref;
    private Preference mNotifTickerColor;
    private Preference mNoNotifColorPref;
    private Preference mClearLabelColorPref;
    private Preference mOngoingNotifColorPref;
    private Preference mLatestNotifColorPref;
    private Preference mNotifItemTitlePref;
    private Preference mNotifItemTextPref;
    private Preference mNotifItemTimePref;
    
    private ListPreference mWindowAnimationsPref;
    private ListPreference mTransitionAnimationsPref;
    private CheckBoxPreference mFancyImeAnimationsPref;
    private CheckBoxPreference mHapticFeedbackPref;
    private ListPreference mEndButtonPref;
    private CheckBoxPreference mCompatibilityMode;
    private CheckBoxPreference mPinHomePref;
    private CheckBoxPreference mLauncherOrientationPref;
    private CheckBoxPreference mLauncherColumnPref;
    private CheckBoxPreference mBatteryStatusPref;
    private CheckBoxPreference mCompcachePref;
    private CheckBoxPreference mShowClockPref;

    private IWindowManager mWindowManager;

    private int swapEnabled = -1;
    
    private boolean isSwapEnabled() {
        if (swapEnabled > -1) {
            swapEnabled = new File("/proc/swaps").exists() ? 1 : 0;
        }
        return swapEnabled > 1;
    }

    public static boolean updatePreferenceToSpecificActivityOrRemove(Context context,
            PreferenceGroup parentPreferenceGroup, String preferenceKey, int flags) {
        
        Preference preference = parentPreferenceGroup.findPreference(preferenceKey);
        if (preference == null) {
            return false;
        }
        
        Intent intent = preference.getIntent();
        if (intent != null) {
            // Find the activity that is in the system image
            PackageManager pm = context.getPackageManager();
            List<ResolveInfo> list = pm.queryIntentActivities(intent, 0);
            int listSize = list.size();
            for (int i = 0; i < listSize; i++) {
                ResolveInfo resolveInfo = list.get(i);
                if ((resolveInfo.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM)
                        != 0) {
                    
                    // Replace the intent with this specific activity
                    preference.setIntent(new Intent().setClassName(
                            resolveInfo.activityInfo.packageName,
                            resolveInfo.activityInfo.name));
                    
                    return true;
                }
            }
        }

        // Did not find a matching activity, so remove the preference
        parentPreferenceGroup.removePreference(preference);
        
        return true;
    }
    
    @Override
    public void onCreate(Bundle icicle) {
        super.onCreate(icicle);
        addPreferencesFromResource(R.xml.spare_parts);

        PreferenceScreen prefSet = getPreferenceScreen();
        
        mRecentAppsNumPref = (ListPreference) prefSet.findPreference(RECENT_APPS_NUM_PREF);
        mRecentAppsNumPref.setOnPreferenceChangeListener(this);
        mWindowAnimationsPref = (ListPreference) prefSet.findPreference(WINDOW_ANIMATIONS_PREF);
        mWindowAnimationsPref.setOnPreferenceChangeListener(this);
        mTransitionAnimationsPref = (ListPreference) prefSet.findPreference(TRANSITION_ANIMATIONS_PREF);
        mTransitionAnimationsPref.setOnPreferenceChangeListener(this);
        mFancyImeAnimationsPref = (CheckBoxPreference) prefSet.findPreference(FANCY_IME_ANIMATIONS_PREF);
        mHapticFeedbackPref = (CheckBoxPreference) prefSet.findPreference(HAPTIC_FEEDBACK_PREF);
        mEndButtonPref = (ListPreference) prefSet.findPreference(END_BUTTON_PREF);
        mEndButtonPref.setOnPreferenceChangeListener(this);
        mPinHomePref = (CheckBoxPreference) prefSet.findPreference(PIN_HOME_PREF);
        mLauncherOrientationPref = (CheckBoxPreference) prefSet.findPreference(LAUNCHER_ORIENTATION_PREF);
        mLauncherColumnPref = (CheckBoxPreference) prefSet.findPreference(LAUNCHER_COLUMN_PREF);
        mCompcachePref = (CheckBoxPreference) prefSet.findPreference(COMPCACHE_PREF);
        
        mBatteryStatusPref = (CheckBoxPreference) prefSet.findPreference(BATTERY_STATUS_PREF);
        mBatteryPercentColorPreference = prefSet.findPreference(UI_BATTERY_PERCENT_COLOR);
        mShowClockPref = (CheckBoxPreference) prefSet.findPreference(UI_SHOW_STATUS_CLOCK);        
        mClockColorPref = prefSet.findPreference(UI_CLOCK_COLOR);
        mDateColorPref = prefSet.findPreference(UI_DATE_COLOR);
        mSpnLabelColorPref = prefSet.findPreference(UI_SPN_LABEL_COLOR);
        mPlmnLabelColorPref = prefSet.findPreference(UI_PLMN_LABEL_COLOR);
        
        mNotifTickerColor = prefSet.findPreference(UI_NOTIF_TICKER_COLOR);
        mNoNotifColorPref = prefSet.findPreference(UI_NO_NOTIF_COLOR);
        mClearLabelColorPref = prefSet.findPreference(UI_CLEAR_LABEL_COLOR);
        mOngoingNotifColorPref = prefSet.findPreference(UI_ONGOING_NOTIF_COLOR);        
        mLatestNotifColorPref = prefSet.findPreference(UI_LATEST_NOTIF_COLOR);        
        mNotifItemTitlePref = prefSet.findPreference(UI_NOTIF_ITEM_TITLE_COLOR);
        mNotifItemTextPref = prefSet.findPreference(UI_NOTIF_ITEM_TEXT_COLOR);
        mNotifItemTimePref = prefSet.findPreference(UI_NOTIF_ITEM_TIME_COLOR);
        
        if (!isSwapEnabled()) {
            prefSet.removePreference(mCompcachePref);
        }
        
        mCompatibilityMode = (CheckBoxPreference) findPreference(KEY_COMPATIBILITY_MODE);
        mCompatibilityMode.setPersistent(false);
        mCompatibilityMode.setChecked(Settings.System.getInt(getContentResolver(),
                Settings.System.COMPATIBILITY_MODE, 1) != 0);

        mWindowManager = IWindowManager.Stub.asInterface(ServiceManager.getService("window"));
        
        final PreferenceGroup parentPreference = getPreferenceScreen();
        updatePreferenceToSpecificActivityOrRemove(this, parentPreference,
                BATTERY_HISTORY_PREF, 0);
        updatePreferenceToSpecificActivityOrRemove(this, parentPreference,
                BATTERY_INFORMATION_PREF, 0);
        updatePreferenceToSpecificActivityOrRemove(this, parentPreference,
                USAGE_STATISTICS_PREF, 0);
        
        parentPreference.getSharedPreferences().registerOnSharedPreferenceChangeListener(this);
    }

    private void updateToggles() {
            mFancyImeAnimationsPref.setChecked(Settings.System.getInt(
                    getContentResolver(), 
                    Settings.System.FANCY_IME_ANIMATIONS, 0) != 0);
            mHapticFeedbackPref.setChecked(Settings.System.getInt(
                    getContentResolver(), 
                    Settings.System.HAPTIC_FEEDBACK_ENABLED, 0) != 0);
            mPinHomePref.setChecked(Settings.System.getInt(
                    getContentResolver(),
                    "pin_home_in_memory", 0) != 0);
            mLauncherOrientationPref.setChecked(Settings.System.getInt(
                    getContentResolver(),
                    "launcher_orientation", 0) != 0);
            mLauncherColumnPref.setChecked(Settings.System.getInt(
                    getContentResolver(),
                    Settings.System.LAUNCHER_COLUMN_NUMBER, 5) != 4);
            mBatteryStatusPref.setChecked(Settings.System.getInt(
                    getContentResolver(),
                    Settings.System.BATTERY_PERCENTAGE_STATUS_ICON, 0) != 0);
            mCompcachePref.setChecked(Settings.Secure.getInt(
            		getContentResolver(),
            		Settings.Secure.COMPCACHE_ENABLED, 0) != 0);
            mShowClockPref.setChecked(Settings.System.getInt(
            		getContentResolver(),
            		Settings.System.SHOW_STATUS_CLOCK, 0) != 0);
    }
    
    public boolean onPreferenceChange(Preference preference, Object objValue) {
        if (preference == mWindowAnimationsPref) {
            writeAnimationPreference(0, objValue);
        } else if (preference == mTransitionAnimationsPref) {
            writeAnimationPreference(1, objValue);
        } else if (preference == mEndButtonPref) {
            writeEndButtonPreference(objValue);
        } else if (preference == mRecentAppsNumPref) {
            writeRecentAppsNumPreference(objValue);
        }
        
        // always let the preference setting proceed.
        return true;
    }

    @Override
    public boolean onPreferenceTreeClick(PreferenceScreen preferenceScreen, Preference preference) {
        if (preference == mCompatibilityMode) {
            Settings.System.putInt(getContentResolver(),
                    Settings.System.COMPATIBILITY_MODE,
                    mCompatibilityMode.isChecked() ? 1 : 0);
            return true;
        }
        else if (preference == mClockColorPref) {
			ColorPickerDialog cp = new ColorPickerDialog(this,
				mClockFontColorListener,
				readClockFontColor());
			cp.show();            
        }
        else if (preference == mDateColorPref) {
			ColorPickerDialog cp = new ColorPickerDialog(this,
				mDateFontColorListener,
				readDateFontColor());
			cp.show();            
        }
        else if (preference == mSpnLabelColorPref) {
			ColorPickerDialog cp = new ColorPickerDialog(this,
				mSpnLabelColorListener,
				readSpnLabelColor());
			cp.show();
        }
        else if (preference == mPlmnLabelColorPref) {
			ColorPickerDialog cp = new ColorPickerDialog(this,
				mPlmnLabelColorListener,
				readPlmnLabelColor());
			cp.show();
        }
        else if (preference == mBatteryPercentColorPreference) {
			ColorPickerDialog cp = new ColorPickerDialog(this,
				mBatteryColorListener,
				readBatteryColor());
			cp.show();
        }
        else if (preference == mNotifTickerColor) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mNotifTickerColorListener,
				readNotifTickerColor());
			cp.show();
        }
        else if (preference == mNoNotifColorPref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mNoNotifColorListener,
				readNoNotifColor());
			cp.show();
        }
        else if (preference == mClearLabelColorPref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mClearLabelColorListener,
				readClearLabelColor());
			cp.show();
        }
        else if (preference == mOngoingNotifColorPref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mOngoingNotifColorListener,
				readOngoingNotifColor());
			cp.show();
        }
        else if (preference == mLatestNotifColorPref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mLatestNotifColorListener,
				readLatestNotifColor());
			cp.show();
        }
        else if (preference == mNotifItemTitlePref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mNotifItemTitleColorListener,
				readNotifItemTitleColor());
			cp.show();
        }
        else if (preference == mNotifItemTextPref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mNotifItemTextColorListener,
				readNotifItemTextColor());
			cp.show();
        }
        else if (preference == mNotifItemTimePref) {
            ColorPickerDialog cp = new ColorPickerDialog(this,
				mNotifItemTimeColorListener,
				readNotifItemTimeColor());
			cp.show();
        }
        
        return false;
    }

    public void writeAnimationPreference(int which, Object objValue) {
        try {
            float val = Float.parseFloat(objValue.toString());
            mWindowManager.setAnimationScale(which, val);
        } catch (NumberFormatException e) {
        } catch (RemoteException e) {
        }
    }
    
    public void writeEndButtonPreference(Object objValue) {
        try {
            int val = Integer.parseInt(objValue.toString());
            Settings.System.putInt(getContentResolver(),
                    Settings.System.END_BUTTON_BEHAVIOR, val);
        } catch (NumberFormatException e) {
        }
    }
    
    public void writeRecentAppsNumPreference(Object objValue) {
        try {
            int val = Integer.parseInt(objValue.toString());
            Settings.System.putInt(getContentResolver(),
                    Settings.System.RECENT_APPS_NUMBER, val);
        } catch (NumberFormatException e) {
        }
    }
    
    int floatToIndex(float val, int resid) {
        String[] indices = getResources().getStringArray(resid);
        float lastVal = Float.parseFloat(indices[0]);
        for (int i=1; i<indices.length; i++) {
            float thisVal = Float.parseFloat(indices[i]);
            if (val < (lastVal + (thisVal-lastVal)*.5f)) {
                return i-1;
            }
            lastVal = thisVal;
        }
        return indices.length-1;
    }
    
    public void readAnimationPreference(int which, ListPreference pref) {
        try {
            float scale = mWindowManager.getAnimationScale(which);
            pref.setValueIndex(floatToIndex(scale,
                    R.array.entryvalues_animations));
        } catch (RemoteException e) {
        }
    }
    
    public void readEndButtonPreference(ListPreference pref) {
        try {
            pref.setValueIndex(Settings.System.getInt(getContentResolver(),
                    Settings.System.END_BUTTON_BEHAVIOR));
        } catch (SettingNotFoundException e) {
        }
    }
    
    //Wysie_Soh
    public void readRecentAppsNumPreference(ListPreference pref) {
        try {
            int value = Settings.System.getInt(getContentResolver(), Settings.System.RECENT_APPS_NUMBER);
            pref.setValueIndex(recentAppsToIndex(value));
        } catch (SettingNotFoundException e) {
        }
    }
    
    private int recentAppsToIndex(int value) {
        switch (value) {
            case 6:
                return 0;
            case 9:
                return 1;
            case 12:
                return 2;
            case 15:
                return 3;
             default:
                return 0;            
        }
    }
    
	private int readClockFontColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.CLOCK_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mClockFontColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.CLOCK_COLOR, color);
			}
	};
	
	private int readDateFontColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.DATE_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mDateFontColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.DATE_COLOR, color);
			}
	};
	
	private int readSpnLabelColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.SPN_LABEL_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mSpnLabelColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.SPN_LABEL_COLOR, color);
			}
	};
	
	private int readPlmnLabelColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.PLMN_LABEL_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mPlmnLabelColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.PLMN_LABEL_COLOR, color);
			}
	};
	
	private int readBatteryColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.BATTERY_PERCENTAGE_STATUS_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -1;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mBatteryColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.BATTERY_PERCENTAGE_STATUS_COLOR, color);
			}
	};
	
	private int readNotifTickerColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.NEW_NOTIF_TICKER_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mNotifTickerColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.NEW_NOTIF_TICKER_COLOR, color);
			}
	};
	
	private int readNoNotifColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.NO_NOTIF_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -1;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mNoNotifColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.NO_NOTIF_COLOR, color);
			}
	};
	
	private int readClearLabelColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.CLEAR_BUTTON_LABEL_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mClearLabelColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.CLEAR_BUTTON_LABEL_COLOR, color);
			}
	};
	
	private int readOngoingNotifColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.ONGOING_NOTIF_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -1;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mOngoingNotifColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.ONGOING_NOTIF_COLOR, color);
			}
	};
	
	private int readLatestNotifColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.LATEST_NOTIF_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -1;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mLatestNotifColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.LATEST_NOTIF_COLOR, color);
			}
	};
	
	private int readNotifItemTitleColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.NOTIF_ITEM_TITLE_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mNotifItemTitleColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.NOTIF_ITEM_TITLE_COLOR, color);
			}
	};
	
	private int readNotifItemTextColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.NOTIF_ITEM_TEXT_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mNotifItemTextColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.NOTIF_ITEM_TEXT_COLOR, color);
			}
	};
	
	private int readNotifItemTimeColor() {
        try {
    		return Settings.System.getInt(getContentResolver(), Settings.System.NOTIF_ITEM_TIME_COLOR);
        }
        catch (SettingNotFoundException e) {
            return -16777216;
        }
	}
	
	ColorPickerDialog.OnColorChangedListener mNotifItemTimeColorListener = 
		new ColorPickerDialog.OnColorChangedListener() {
			public void colorChanged(int color) {
				Settings.System.putInt(getContentResolver(), Settings.System.NOTIF_ITEM_TIME_COLOR, color);
			}
	};
	
    public void onSharedPreferenceChanged(SharedPreferences preferences, String key) {
        if (FANCY_IME_ANIMATIONS_PREF.equals(key)) {
            Settings.System.putInt(getContentResolver(),
                    Settings.System.FANCY_IME_ANIMATIONS,
                    mFancyImeAnimationsPref.isChecked() ? 1 : 0);
        } else if (HAPTIC_FEEDBACK_PREF.equals(key)) {
            Settings.System.putInt(getContentResolver(),
                    Settings.System.HAPTIC_FEEDBACK_ENABLED,
                    mHapticFeedbackPref.isChecked() ? 1 : 0);
        } else if (PIN_HOME_PREF.equals(key)) {
            Settings.System.putInt(getContentResolver(), "pin_home_in_memory",
                    mPinHomePref.isChecked() ? 1 : 0);
        } else if (LAUNCHER_ORIENTATION_PREF.equals(key)) {
            Settings.System.putInt(getContentResolver(), "launcher_orientation",
                    mLauncherOrientationPref.isChecked() ? 1 : 0);
        } else if (LAUNCHER_COLUMN_PREF.equals(key)) {
            Settings.System.putInt(getContentResolver(),
                    Settings.System.LAUNCHER_COLUMN_NUMBER,
                    mLauncherColumnPref.isChecked() ? 5 : 4);
        } else if (BATTERY_STATUS_PREF.equals(key)) {
            Settings.System.putInt(getContentResolver(),
                    Settings.System.BATTERY_PERCENTAGE_STATUS_ICON,
                    mBatteryStatusPref.isChecked() ? 1 : 0);
        } else if (COMPCACHE_PREF.equals(key)) {
        	Settings.Secure.putInt(getContentResolver(), Settings.Secure.COMPCACHE_ENABLED,
        			mCompcachePref.isChecked() ? 1 : 0);
        } else if (UI_SHOW_STATUS_CLOCK.equals(key)) {
        	Settings.System.putInt(getContentResolver(), Settings.System.SHOW_STATUS_CLOCK,
        			mShowClockPref.isChecked() ? 1 : 0);
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        readAnimationPreference(0, mWindowAnimationsPref);
        readAnimationPreference(1, mTransitionAnimationsPref);
        readEndButtonPreference(mEndButtonPref);
        readRecentAppsNumPreference(mRecentAppsNumPref);
        updateToggles();
    }
}
