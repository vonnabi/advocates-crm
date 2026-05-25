from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_app", "0003_calendarevent_is_demo_reminder_is_demo"),
    ]

    operations = [
        migrations.AddField(
            model_name="calendarevent",
            name="procedural_action",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
