from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_crmsettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="crmsettings",
            name="integration_settings",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
