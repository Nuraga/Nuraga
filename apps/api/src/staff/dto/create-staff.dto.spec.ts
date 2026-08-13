import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateStaffDto } from "./create-staff.dto";

// Regression test for a real bug: class-validator's @IsOptional() only
// exempts null/undefined, not "" — and the frontend form sends "" for an
// untouched Email field, which used to fail @IsEmail() with a confusing
// "email must be an email" even though email is meant to be optional
// (email-or-phone is enforced separately in StaffService).
describe("CreateStaffDto", () => {
  it("accepts an empty-string email as long as phone is filled", async () => {
    const dto = plainToInstance(CreateStaffDto, {
      fullName: "Тест Тестова",
      email: "",
      phone: "+77001234567",
      password: "secret123",
      role: "TEACHER",
      position: "Воспитатель",
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("still rejects a malformed non-empty email", async () => {
    const dto = plainToInstance(CreateStaffDto, {
      fullName: "Тест Тестова",
      email: "not-an-email",
      phone: "+77001234567",
      password: "secret123",
      role: "TEACHER",
      position: "Воспитатель",
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === "email")).toBeDefined();
  });
});
