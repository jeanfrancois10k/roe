# Proguard rules for ROE BOLET Android Vendor POS
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
